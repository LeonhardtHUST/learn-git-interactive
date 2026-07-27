/**
 * 主 TUI 应用组件
 *
 * 五区域布局：顶栏 / 会话流 / Git 状态卡 / 提交图 / 底部输入
 */

import { type CliRenderer, TextAttributes, createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { For } from "solid-js";

import { handleInput } from "./commands";
import { initEngine } from "./engine";
import { LoginScreen } from "./login";
import { OpenCodeTheme } from "./theme";
import {
  addMessage,
  autograde,
  commitGraph,
  gitStatus,
  inputValue,
  progress,
  screen,
  setScreen,
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
      backgroundColor={OpenCodeTheme.background}
      paddingLeft={1}
      paddingRight={1}
      height={3}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <text fg={OpenCodeTheme.primary} attributes={TextAttributes.BOLD}>
        {`🎓 ${progress().course}`}
      </text>
      <text fg={OpenCodeTheme.textMuted}>{`${progress().chapter} | ${progress().lesson}`}</text>
      <text fg={OpenCodeTheme.success}>
        {`进度 ${progress().completed}/${progress().total} ${autograde() ? "· 自动判题:开" : "· 自动判题:关"}`}
      </text>
    </box>
  );
}

// ── 子组件：会话消息流 ────────────────────────────────────

const MESSAGE_STYLES: Record<SessionMessage["type"], { fg: string; prefix: string }> = {
  system: { fg: OpenCodeTheme.text, prefix: "" },
  user: { fg: OpenCodeTheme.secondary, prefix: "" },
  "git-output": { fg: OpenCodeTheme.success, prefix: "" },
  result: { fg: OpenCodeTheme.textEmphasized, prefix: "" },
  hint: { fg: OpenCodeTheme.accent, prefix: "💡 " },
};

function MessageBubble(props: { msg: SessionMessage }) {
  const style = () => MESSAGE_STYLES[props.msg.type];
  const lines = () => props.msg.content.split("\n");
  return (
    <box paddingLeft={1} flexDirection="column">
      <For each={lines()}>
        {(line, idx) => (
          <text fg={style().fg}>{`${idx() === 0 ? style().prefix : ""}${line}`}</text>
        )}
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
      backgroundColor={OpenCodeTheme.backgroundPanel}
      borderStyle="single"
      borderColor={OpenCodeTheme.border}
      padding={1}
      flexDirection="column"
      height={6}
    >
      <text fg={OpenCodeTheme.primary} attributes={TextAttributes.BOLD}>
        📊 Git 状态
      </text>
      <text fg={OpenCodeTheme.text}>
        {`分支：${gitStatus().branch} | HEAD：${gitStatus().head}`}
      </text>
      <text fg={OpenCodeTheme.text}>
        {`工作区：${gitStatus().workingTree} | 暂存区：${gitStatus().index}`}
      </text>
      <text fg={OpenCodeTheme.text}>{`远程：${gitStatus().remoteTracking}`}</text>
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
      addMessage("system", `⚠ 处理命令时出错：${err instanceof Error ? err.message : String(err)}`);
    });
  };

  return (
    <box
      borderStyle="single"
      borderColor={OpenCodeTheme.border}
      paddingLeft={1}
      paddingRight={1}
      height={4}
      flexDirection="column"
    >
      <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
        ↑ 输入 Git 命令或 / 命令 | /help 查看帮助 | /quit 退出
      </text>
      <input
        flexGrow={1}
        placeholder="输入命令..."
        value={inputValue()}
        focused
        backgroundColor={OpenCodeTheme.backgroundPanel}
        textColor={OpenCodeTheme.text}
        focusedBackgroundColor={OpenCodeTheme.backgroundPanel}
        focusedTextColor={OpenCodeTheme.text}
        placeholderColor={OpenCodeTheme.textMuted}
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
      backgroundColor={OpenCodeTheme.backgroundPanel}
      borderStyle="single"
      borderColor={OpenCodeTheme.border}
      padding={1}
      flexDirection="column"
      flexShrink={0}
    >
      <text fg={OpenCodeTheme.primary} attributes={TextAttributes.BOLD}>
        📈 提交关系图
      </text>
      <For each={commitGraph()}>{(line) => <text fg={OpenCodeTheme.success}>{line}</text>}</For>
    </box>
  );
}

// ── 主组件 ────────────────────────────────────────────────

function App() {
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={OpenCodeTheme.background}
    >
      <TopBar />
      <SessionFlow />
      {showGitStatus() && <GitStatusCard />}
      {showCommitGraph() && <CommitGraph />}
      <BottomInput />
    </box>
  );
}

// ── 根组件：屏幕切换 ──────────────────────────────────────

/**
 * 顶层根组件：依据 screen() 信号在登录界面与主课程界面之间切换。
 *
 * 关键约束：对同一个 CliRenderer 只能调用一次 render()——
 * mountSolidRoot 的 dispose 只在 renderer 销毁时触发，二次 render 会把新根
 * 追加到 renderer.root 上（旧根不卸载），导致两棵组件树竞争布局与焦点。
 * 因此屏幕切换必须由 Solid reconciler 通过信号完成，而非再次 render()。
 */
function Root() {
  return screen() === "login" ? <LoginScreen onComplete={enterCourse} /> : <App />;
}

// ── 登录 → 主课程 的衔接 ──────────────────────────────────

/**
 * 落盘用户身份并初始化课程引擎（不含 UI 状态设置与屏幕切换）。
 * 供 prepareCourse（测试入口）与 enterCourse（UI 入口）复用，避免逻辑重复。
 */
async function initCourseBackend(u: SavedConfig["user"]): Promise<void> {
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

/**
 * 落盘身份并初始化引擎（测试入口：全 await，完成后即可渲染 <App />）。
 * 不负责屏幕切换——测试自行 testRender(<App />)，避免跨渲染器异步竞态。
 */
export async function prepareCourse(u: SavedConfig["user"]): Promise<void> {
  setUser(u);
  addMessage("system", `👋 欢迎，${u.name}！我们开始学习吧。输入 /lessons 查看全部课程。`);
  await initCourseBackend(u);
}

/**
 * 登录完成回调：立即切换到主课程界面，引擎在后台初始化（不阻塞 UI）。
 *
 * 关键：setScreen("course") 必须在 initEngine 之前同步执行——initEngine 会
 * 重建实验仓库、跑多个 git 命令（数秒），若等它完成才切屏幕，用户会感觉
 * 「点确认没反应」。先切屏幕让 App 立即显示（进度暂为「加载中」），引擎
 * 完成后通过 progress/gitStatus/sessionMessages 信号驱动 App 渐进更新。
 */
export async function enterCourse(u: SavedConfig["user"]): Promise<void> {
  setUser(u);
  addMessage("system", `👋 欢迎，${u.name}！我们开始学习吧。输入 /lessons 查看全部课程。`);
  // 立即切换屏幕：Solid reconciler 卸载 LoginScreen、挂载 App 并转移焦点
  setScreen("course");
  // 后台落盘并初始化引擎；失败时在主界面会话流里提示
  try {
    await initCourseBackend(u);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addMessage("system", `⚠ 课程初始化失败：${msg}`);
  }
}

// ── 入口 ──────────────────────────────────────────────────

// 全局复用同一个 CliRenderer：登录界面与主课程界面共享 stdin/stdout，
// 避免切换时再次 createCliRenderer 触发 "stdin is already used" 错误。
let renderer: CliRenderer | undefined;

async function getRenderer(): Promise<CliRenderer> {
  if (!renderer || renderer.isDestroyed) {
    renderer = await createCliRenderer({ useMouse: true });
  }
  return renderer;
}

export default App;

export async function startTui() {
  let cfg: SavedConfig;
  try {
    cfg = await loadConfig();
  } catch {
    cfg = defaultConfig();
  }
  const r = await getRenderer();
  if (hasIdentity(cfg)) {
    setUser(cfg.user);
    setScreen("course"); // 有身份：Root 首次渲染即主课程界面
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
  }
  // 对同一 renderer 只 render 一次；后续屏幕切换全部经由 screen 信号
  await render(() => <Root />, r);
}
