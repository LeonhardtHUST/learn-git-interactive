/**
 * TUI 学习引擎
 *
 * 桥接会话沙箱、课程加载、受限命令执行与判题系统，向 UI 暴露高层动作。
 * UI 层（commands.ts / app.tsx）只调用这里的函数，不直接触碰后端。
 */

import type { Chapter, Lesson } from "../course/schema";
import { type LoadedCourse, loadCourse } from "../course/loader";
import type { CapabilityPolicy } from "../git/capability_policy";
import { execGit, runUserGitCommand } from "../git/runner";
import { grade } from "../grader/grader";
import { buildFixture } from "../sandbox/fixtures";
import { createSession, newSessionId, type SessionPaths } from "../sandbox/session";
import {
  addMessage,
  type GitStatus,
  setAutograde,
  setCommitGraph,
  setGitStatus,
  setProgress,
} from "./store";

/** 关卡在扁平列表中的元信息 */
interface LessonEntry {
  lesson: Lesson;
  chapter: Chapter;
  /** 从 1 开始的全局序号 */
  order: number;
}

interface EngineState {
  loaded: LoadedCourse;
  session: SessionPaths;
  entries: LessonEntry[];
  currentIndex: number;
  hintIndex: number;
  autograde: boolean;
  completed: Set<string>;
}

let state: EngineState | null = null;

function requireState(): EngineState {
  if (!state) throw new Error("引擎尚未初始化");
  return state;
}

function currentEntry(): LessonEntry {
  const s = requireState();
  const entry = s.entries[s.currentIndex];
  if (!entry) throw new Error("当前关卡不存在");
  return entry;
}

/** 由当前关卡能力配置派生受限策略 */
function currentPolicy(): CapabilityPolicy {
  const { lesson } = currentEntry();
  return {
    commands: lesson.capabilities.commands,
    deniedFlags: lesson.capabilities.deniedFlags,
  };
}

// ── 初始化 ────────────────────────────────────────────────

/** 初始化引擎：创建会话、加载课程、进入首个关卡 */
export async function initEngine(opts: { baseDir?: string } = {}): Promise<void> {
  const loaded = await loadCourse("zh-CN");
  const sessionId = newSessionId();
  const session = await createSession(sessionId, opts.baseDir);

  // 按课程 → 章节 → 关卡顺序扁平化。
  // loaded.lessons 是按「章节文件顺序」插入的 Map，用 source.chapter 的章号归属到各章。
  const entries: LessonEntry[] = [];
  let order = 0;
  const assigned = new Set<string>();
  for (const chapter of loaded.chapters) {
    const prefix = chapterNumber(chapter.id);
    for (const lesson of loaded.lessons.values()) {
      if (assigned.has(lesson.id)) continue;
      if (lesson.source.chapter.startsWith(prefix)) {
        order += 1;
        assigned.add(lesson.id);
        entries.push({ lesson, chapter, order });
      }
    }
  }

  state = {
    loaded,
    session,
    entries,
    currentIndex: 0,
    hintIndex: 0,
    autograde: true,
    completed: new Set(),
  };
  setAutograde(true);

  await enterLesson(0, { announce: true });
}

/** 从章节 id（如 ch03-branch）取出章号前缀（如 "3"），用于匹配 lesson.source.chapter（如 "3.2"） */
function chapterNumber(chapterId: string): string {
  const m = chapterId.match(/ch0*(\d+)/);
  return m ? `${m[1]}.` : chapterId;
}

// ── 关卡导航 ──────────────────────────────────────────────

/** 进入指定序号关卡（0-based），重建 fixture 并刷新 UI */
async function enterLesson(index: number, opts: { announce?: boolean } = {}): Promise<void> {
  const s = requireState();
  const entry = s.entries[index];
  if (!entry) return;
  s.currentIndex = index;
  s.hintIndex = 0;

  const { lesson } = entry;
  await buildFixture(s.session, lesson.setup.fixture);
  await refreshStatus();
  refreshProgress();

  if (opts.announce) {
    addMessage(
      "system",
      `📗 关卡 ${index + 1}/${s.entries.length}：${lesson.title}\n\n${lesson.intro}`,
    );
    addMessage("system", `🎯 任务：\n${lesson.task}`);
    addMessage("system", "完成后输入 /grade 判题；随时 /hint 提示、/reset 重来、/task 复看任务。");
  }
}

/** 列出全部关卡（含完成标记） */
export function listLessons(): void {
  const s = requireState();
  const lines: string[] = ["📋 课程关卡列表：\n"];
  let lastChapter = "";
  for (const entry of s.entries) {
    if (entry.chapter.id !== lastChapter) {
      lines.push(`\n${entry.chapter.title}`);
      lastChapter = entry.chapter.id;
    }
    const done = s.completed.has(entry.lesson.id) ? "✅" : "⬜";
    const here = entry.order - 1 === s.currentIndex ? " ⟵ 当前" : "";
    lines.push(`  ${done} ${entry.order}. ${entry.lesson.title}${here}`);
  }
  lines.push("\n输入 /lesson <序号> 跳转（如 /lesson 3），或 /next、/prev 切换。");
  addMessage("system", lines.join("\n"));
}

/** 跳转到指定序号关卡（1-based） */
export async function gotoLesson(n: number): Promise<void> {
  const s = requireState();
  if (!Number.isInteger(n) || n < 1 || n > s.entries.length) {
    addMessage("system", `序号无效。请输入 1~${s.entries.length} 之间的关卡编号。`);
    return;
  }
  await enterLesson(n - 1, { announce: true });
}

/** 下一关 */
export async function nextLesson(): Promise<void> {
  const s = requireState();
  if (s.currentIndex + 1 >= s.entries.length) {
    addMessage("system", "🎉 已经是最后一关了。输入 /lessons 回看全部关卡。");
    return;
  }
  await enterLesson(s.currentIndex + 1, { announce: true });
}

/** 上一关 */
export async function prevLesson(): Promise<void> {
  const s = requireState();
  if (s.currentIndex === 0) {
    addMessage("system", "已经是第一关了。");
    return;
  }
  await enterLesson(s.currentIndex - 1, { announce: true });
}

// ── 命令执行与判题 ────────────────────────────────────────

/** 执行一行用户 Git 命令：受关卡能力策略约束，随后刷新状态并（可选）自动判题 */
export async function runGit(input: string): Promise<void> {
  const s = requireState();
  addMessage("user", `$ ${input}`);

  const result = await runUserGitCommand(input, {
    cwd: s.session.learnerRepo,
    session: s.session,
    policy: currentPolicy(),
  });

  if (result.rejected) {
    addMessage("system", `⛔ ${result.rejected}`);
    return;
  }

  const body = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  addMessage("git-output", body || (result.ok ? "（命令执行成功，无输出）" : "（命令返回非零）"));

  await refreshStatus();

  if (s.autograde) {
    await gradeCurrent({ silentOnFail: true });
  }
}

/** 判定当前关卡；silentOnFail 时未通过不打扰（用于自动判题） */
export async function gradeCurrent(opts: { silentOnFail?: boolean } = {}): Promise<void> {
  const s = requireState();
  const { lesson } = currentEntry();
  const outcome = await grade({ repo: s.session.learnerRepo, session: s.session }, lesson.checks);

  if (outcome.passed) {
    const already = s.completed.has(lesson.id);
    s.completed.add(lesson.id);
    refreshProgress();
    if (!already) {
      addMessage("result", `✅ 通关：${lesson.title}`);
      if (lesson.explanation) addMessage("system", `📝 讲解：\n${lesson.explanation}`);
      const hasNext = s.currentIndex + 1 < s.entries.length;
      addMessage("system", hasNext ? "输入 /next 进入下一关。" : "🎉 恭喜，你已完成全部关卡！");
    } else {
      addMessage("result", "✅ 目标已达成。");
    }
    return;
  }

  if (opts.silentOnFail) return;

  const failed = outcome.results.filter((r) => !r.passed);
  const lines = ["❌ 尚未通过，还差："];
  for (const r of failed) {
    lines.push(`  · ${r.detail ?? describeCheck(r.check.type)}`);
  }
  lines.push("\n输入 /hint 获取提示，或 /task 复看任务。");
  addMessage("system", lines.join("\n"));
}

function describeCheck(type: string): string {
  return `检查未通过：${type}`;
}

// ── 提示 / 重置 / 任务 ────────────────────────────────────

/** 分级给出下一条提示 */
export function nextHint(): void {
  const s = requireState();
  const { lesson } = currentEntry();
  if (s.hintIndex >= lesson.hints.length) {
    addMessage("hint", "提示已全部给出。可尝试 /reset 重来，或 /task 复看任务。");
    return;
  }
  const hint = lesson.hints[s.hintIndex];
  s.hintIndex += 1;
  addMessage("hint", `提示 ${s.hintIndex}/${lesson.hints.length}：${hint}`);
}

/** 重建当前关卡的实验仓库 */
export async function resetCurrent(): Promise<void> {
  const s = requireState();
  const { lesson } = currentEntry();
  await buildFixture(s.session, lesson.setup.fixture);
  s.hintIndex = 0;
  await refreshStatus();
  addMessage("system", "🔄 实验仓库已重置为关卡初始状态。");
}

/** 复看当前关卡任务 */
export function showTask(): void {
  const { lesson } = currentEntry();
  addMessage("system", `🎯 任务：\n${lesson.task}`);
}

/** 切换自动判题开关 */
export function toggleAutograde(): void {
  const s = requireState();
  s.autograde = !s.autograde;
  setAutograde(s.autograde);
  addMessage(
    "system",
    s.autograde
      ? "🤖 自动判题：开。每次命令后会自动检查是否通关。"
      : "🤖 自动判题：关。需手动输入 /grade 判题。",
  );
}

/** 展示当前关卡目标与仓库状态 */
export async function showStatus(): Promise<void> {
  const { lesson, chapter } = currentEntry();
  const git = await refreshStatus();
  const lines = [
    `📊 当前关卡：${chapter.title} · ${lesson.title}`,
    "目标：",
    ...lesson.objectives.map((o) => `  · ${o}`),
    "",
    `仓库：分支 ${git.branch} | HEAD ${git.head} | 工作区 ${git.workingTree} | 暂存区 ${git.index}`,
    `远程：${git.remoteTracking}`,
  ];
  addMessage("system", lines.join("\n"));
}

// ── 仓库状态查询 ──────────────────────────────────────────

async function q(args: string[]): Promise<{ ok: boolean; out: string }> {
  const s = requireState();
  const r = await execGit(args, { cwd: s.session.learnerRepo, session: s.session });
  return { ok: r.ok, out: r.stdout.trim() };
}

/** 查询真实仓库状态并写入 UI 信号，返回快照 */
export async function refreshStatus(): Promise<GitStatus> {
  const branchRes = await q(["symbolic-ref", "--short", "-q", "HEAD"]);
  const headRes = await q(["rev-parse", "--short", "HEAD"]);
  const branch = branchRes.ok && branchRes.out ? branchRes.out : "（游离 HEAD）";
  const head = headRes.ok && headRes.out ? headRes.out : "—";

  // porcelain 统计暂存 / 工作区 / 未跟踪
  const porcelain = await q(["status", "--porcelain"]);
  let staged = 0;
  let worktree = 0;
  let untracked = 0;
  if (porcelain.ok && porcelain.out) {
    for (const line of porcelain.out.split("\n")) {
      if (line.startsWith("??")) {
        untracked += 1;
        continue;
      }
      const x = line[0];
      const y = line[1];
      if (x && x !== " ") staged += 1;
      if (y && y !== " ") worktree += 1;
    }
  }
  const indexText = staged ? `${staged} 项已暂存` : "clean";
  const worktreeParts: string[] = [];
  if (worktree) worktreeParts.push(`${worktree} 项改动`);
  if (untracked) worktreeParts.push(`${untracked} 项未跟踪`);
  const workingTree = worktreeParts.length ? worktreeParts.join("，") : "clean";

  // 上游跟踪
  let remoteTracking = "（无上游）";
  const up = await q(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  if (up.ok && up.out) {
    const counts = await q(["rev-list", "--left-right", "--count", `HEAD...${up.out}`]);
    if (counts.ok && counts.out) {
      const [ahead = "0", behind = "0"] = counts.out.split(/\s+/);
      remoteTracking = `${up.out} ↑${ahead} ↓${behind}`;
    } else {
      remoteTracking = up.out;
    }
  }

  const status: GitStatus = { branch, head, workingTree, index: indexText, remoteTracking };
  setGitStatus(status);

  // 提交图
  const graph = await q(["log", "--graph", "--oneline", "--decorate", "--all", "-n", "12"]);
  setCommitGraph(graph.ok && graph.out ? graph.out.split("\n") : ["（暂无提交）"]);

  return status;
}

// ── 进度 ──────────────────────────────────────────────────

function refreshProgress(): void {
  const s = requireState();
  const { lesson, chapter } = currentEntry();
  setProgress({
    course: s.loaded.course.title,
    chapter: chapter.title,
    lesson: lesson.title,
    completed: s.completed.size,
    total: s.entries.length,
  });
}

// ── 只读访问器（供测试与调试） ────────────────────────────

/** 全部关卡数量 */
export function lessonCount(): number {
  return requireState().entries.length;
}

/** 当前关卡 id */
export function currentLessonId(): string {
  return currentEntry().lesson.id;
}

/** 指定关卡是否已标记完成 */
export function isCompleted(lessonId: string): boolean {
  return requireState().completed.has(lessonId);
}
