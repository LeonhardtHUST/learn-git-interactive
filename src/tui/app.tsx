/**
 * 主 TUI 应用组件
 *
 * 五区域布局：顶栏 / 会话流 / Git 状态卡 / 提交图 / 底部输入
 */

import { TextAttributes } from "@opentui/core";
import { render } from "@opentui/solid";
import { For } from "solid-js";

import { handleInput } from "./commands";
import { initEngine } from "./engine";
import { LoginScreen } from "./login";
import {
  addMessage,
  autograde,
  commitGraph,
  gitStatus,
  inputValue,
  progress,
  setUser,
  type SessionMessage,
  sessionMessages,
  setInputValue,
  showCommitGraph,
  showGitStatus,
} from "./store";
import {
  type SavedConfig,
  defaultConfig,
  hasIdentity,
  loadConfig,
  markLessonComplete,
  saveConfig,
} from "../progress/store";

// ── 子组件：顶栏 ──────────────────────────────────────────

function TopBar() {
  return (
    <box
      backgroundColor="#1a1b26"
      paddingLeft={1}
      paddingRight={1}
      height={3}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <text fg="#7aa2f7" attributes={TextAttributes.BOLD}>
        {"🎓 " + progress().course}
      </text>
      <text fg="#565f89">{progress().chapter + " | " + progress().lesson}</text>
      <text fg="#9ece6a">
        {"进度 " +
          progress().completed +
          "/" +
          progress().total +
          " " +
          (autograde() ? "· 自动判题:开" : "· 自动判题:关")}
      </text>
    </box>
  );
}

// ── 子组件：会话消息流 ────────────────────────────────────

const MESSAGE_STYLES: Record<SessionMessage["type"], { fg: string; prefix: string }> = {
  system: { fg: "#c0caf5", prefix: "" },
  user: { fg: "#7dcfff", prefix: "" },
  "git-output": { fg: "#9ece6a", prefix: "" },
  result: { fg: "#e0af68", prefix: "" },
  hint: { fg: "#bb9af7", prefix: "💡 " },
};

function MessageBubble(props: { msg: SessionMessage }) {
  const style = () => MESSAGE_STYLES[props.msg.type];
  const lines = () => props.msg.content.split("\n");
  return (
    <box paddingLeft={1} flexDirection="column">
      <For each={lines()}>
        {(line, idx) => <text fg={style().fg}>{(idx() === 0 ? style().prefix : "") + line}</text>}
      </For>
    </box>
  );
}

function SessionFlow() {
  return (
    <scrollbox flexGrow={1} flexDirection="column" stickyScroll stickyStart="bottom">
      <For each={sessionMessages()}>{(msg) => <MessageBubble msg={msg} />}</For>
    </scrollbox>
  );
}

// ── 子组件：Git 状态卡 ────────────────────────────────────

function GitStatusCard() {
  return (
    <box
      backgroundColor="#24283b"
      borderStyle="single"
      borderColor="#565f89"
      padding={1}
      flexDirection="column"
      height={6}
    >
      <text fg="#7aa2f7" attributes={TextAttributes.BOLD}>
        📊 Git 状态
      </text>
      <text fg="#c0caf5">{"分支：" + gitStatus().branch + " | HEAD：" + gitStatus().head}</text>
      <text fg="#c0caf5">
        {"工作区：" + gitStatus().workingTree + " | 暂存区：" + gitStatus().index}
      </text>
      <text fg="#c0caf5">{"远程：" + gitStatus().remoteTracking}</text>
    </box>
  );
}

// ── 子组件：底部输入框 ────────────────────────────────────

function BottomInput() {
  const handleSubmit = (value: unknown) => {
    const text = typeof value === "string" ? value : inputValue();
    if (!text.trim()) return;
    setInputValue("");
    handleInput(text).catch((err: unknown) => {
      addMessage(
        "system",
        "⚠ 处理命令时出错：" + (err instanceof Error ? err.message : String(err)),
      );
    });
  };

  return (
    <box
      borderStyle="single"
      borderColor="#3b4261"
      paddingLeft={1}
      paddingRight={1}
      height={4}
      flexDirection="column"
    >
      <text fg="#565f89" attributes={TextAttributes.DIM}>
        ↑ 输入 Git 命令或 / 命令 | /help 查看帮助 | /quit 退出
      </text>
      <input
        placeholder="输入命令..."
        value={inputValue()}
        focused
        onSubmit={handleSubmit}
        onInput={(v: string) => setInputValue(v)}
      />
    </box>
  );
}

// ── 子组件：提交图 ────────────────────────────────────────

function CommitGraph() {
  return (
    <box
      backgroundColor="#24283b"
      borderStyle="single"
      borderColor="#565f89"
      padding={1}
      flexDirection="column"
      flexShrink={0}
    >
      <text fg="#7aa2f7" attributes={TextAttributes.BOLD}>
        📈 提交关系图
      </text>
      <For each={commitGraph()}>{(line) => <text fg="#9ece6a">{line}</text>}</For>
    </box>
  );
}

// ── 主组件 ────────────────────────────────────────────────

function App() {
  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor="#1a1b26">
      <TopBar />
      <SessionFlow />
      {showGitStatus() && <GitStatusCard />}
      {showCommitGraph() && <CommitGraph />}
      <BottomInput />
    </box>
  );
}

// ── 登录 → 主课程 的衔接 ──────────────────────────────────

/**
 * 落盘用户身份并初始化课程引擎（不负责渲染）。
 *
 * 拆分出「状态准备」与「渲染」两步：入口 enterCourse 复用它并追加整体重渲染；
 * 测试则可先 prepareCourse 再自行 testRender(<App />)，避免跨渲染器的异步竞态。
 */
export async function prepareCourse(u: SavedConfig["user"]): Promise<void> {
  setUser(u);
  addMessage("system", `👋 欢迎，${u.name}！我们开始学习吧。输入 /lessons 查看全部课程。`);
  const cfg = await loadConfig();
  const updated = { ...cfg, user: u };
  await saveConfig(updated);
  await initEngine({
    user: u,
    completed: updated.completedLessons,
    onComplete: (lessonId: string) => {
      const next = markLessonComplete(updated, lessonId);
      void saveConfig(next);
    },
  });
}

/** 落盘用户身份、初始化引擎，并切换到主课程界面 */
export async function enterCourse(u: SavedConfig["user"]): Promise<void> {
  try {
    await prepareCourse(u);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addMessage("system", `⚠ 课程初始化失败：${msg}`);
  }
  // 直接整体重渲染为主课程界面（避免在测试/无头渲染器下依赖组件内信号切换）
  await render(() => <App />);
}

// ── 入口 ──────────────────────────────────────────────────

export default App;

export async function startTui() {
  let cfg: SavedConfig;
  try {
    cfg = await loadConfig();
  } catch {
    cfg = defaultConfig();
  }
  if (hasIdentity(cfg)) {
    setUser(cfg.user);
    try {
      await initEngine({
        user: cfg.user,
        completed: cfg.completedLessons,
        onComplete: (lessonId: string) => {
          cfg = markLessonComplete(cfg, lessonId);
          void saveConfig(cfg);
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage("system", `⚠ 课程初始化失败：${msg}`);
    }
    await render(() => <App />);
  } else {
    await render(() => <LoginScreen onComplete={enterCourse} />);
  }
}
