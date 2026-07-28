/**
 * 主 TUI 应用组件
 *
 * 五区域布局：顶栏 / 会话流 / Git 状态卡 / 提交图 / 底部输入
 */

import {
  type BoxRenderable,
  type CliRenderer,
  type KeyEvent,
  TextAttributes,
  createCliRenderer,
} from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, For, onMount } from "solid-js";

import { handleInput } from "./commands";
import { getGitCompletionCandidates, initEngine, shutdownEngine } from "./engine";
import { slashCompletionCandidates } from "./command_catalog";
import { CommandHistoryNavigator } from "./input_history";
import { LoginScreen } from "./login";
import { OpenCodeTheme } from "./theme";
import {
  addMessage,
  autograde,
  commandHistory,
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
  setCommandHistory,
  showCommitGraph,
  showGitStatus,
  user,
} from "./store";
import {
  type SavedConfig,
  defaultConfig,
  hasIdentity,
  loadConfig,
  markLessonComplete,
  appendCommandHistory,
  appendHistoryEntry,
  updateConfig,
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
  const [completionHint, setCompletionHint] = createSignal("");
  const historyNavigator = new CommandHistoryNavigator();
  let completion: { candidates: string[]; index: number } | undefined;

  const clearNavigation = () => {
    historyNavigator.reset();
    completion = undefined;
    setCompletionHint("");
  };

  const saveHistory = (text: string) => {
    const next = appendHistoryEntry(commandHistory(), text);
    if (next !== commandHistory()) setCommandHistory(next);
    void updateConfig((config) => appendCommandHistory(config, text)).catch((error: unknown) => {
      addMessage(
        "system",
        `⚠ 命令历史保存失败：${error instanceof Error ? error.message : String(error)}`,
      );
    });
  };

  const handleSubmit = (value: unknown) => {
    const text = typeof value === "string" ? value : inputValue();
    if (!text.trim()) return;
    saveHistory(text);
    clearNavigation();
    setInputValue("");
    handleInput(text).catch((err: unknown) => {
      addMessage("system", `⚠ 处理命令时出错：${err instanceof Error ? err.message : String(err)}`);
    });
  };

  const browseHistory = (direction: -1 | 1) => {
    const history = commandHistory();
    const value =
      direction < 0
        ? historyNavigator.previous(history, inputValue())
        : historyNavigator.next(history);
    if (value === undefined) return;
    setInputValue(value);
    completion = undefined;
    setCompletionHint("");
  };

  const completeInput = async () => {
    const value = inputValue();
    let candidates: string[];
    if (completion?.candidates.includes(value)) {
      candidates = completion.candidates;
    } else if (value.trimStart().startsWith("/")) {
      candidates = slashCompletionCandidates(value);
    } else {
      candidates = await getGitCompletionCandidates(value);
    }
    if (!candidates.length) {
      completion = undefined;
      setCompletionHint("");
      return;
    }
    const index =
      completion?.candidates === candidates ? (completion.index + 1) % candidates.length : 0;
    completion = { candidates, index };
    setInputValue(candidates[index] ?? "");
    setCompletionHint(
      candidates.length > 1 ? `Tab 补全：${candidates.slice(0, 3).join("  ")}` : "",
    );
  };

  const onKeyDown = (event: KeyEvent) => {
    if (event.name === "up") {
      event.preventDefault();
      browseHistory(-1);
    } else if (event.name === "down") {
      event.preventDefault();
      browseHistory(1);
    } else if (event.name === "tab") {
      event.preventDefault();
      void completeInput();
    }
  };

  return (
    <box
      borderStyle="single"
      borderColor={OpenCodeTheme.border}
      paddingLeft={1}
      paddingRight={1}
      height={5}
      flexDirection="column"
    >
      <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
        ↑ 输入 Git 命令或 / 命令 | Tab 补全 | ↑↓ 历史 | /help 帮助
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
        onInput={(v: string) => {
          setInputValue(v);
          clearNavigation();
        }}
        onKeyDown={onKeyDown}
      />
      {completionHint() ? <text fg={OpenCodeTheme.textMuted}>{completionHint()}</text> : null}
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

const [courseReady, setCourseReady] = createSignal(false);
const [courseInitError, setCourseInitError] = createSignal("");

function startCourseSetup(u: SavedConfig["user"]): void {
  setCourseReady(false);
  setCourseInitError("");
  void initCourseBackend(u)
    .then(() => setCourseReady(true))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setCourseInitError(message);
      addMessage("system", `⚠ 课程初始化失败：${message}`);
    });
}

function beginFirstLesson(): void {
  if (courseInitError()) {
    startCourseSetup(user());
    return;
  }
  if (courseReady()) setScreen("course");
}

function WelcomeScreen() {
  let startButton: BoxRenderable | undefined;
  onMount(() => startButton?.focus());

  const onKeyDown = (event: KeyEvent) => {
    if (event.name === "return" || event.name === "enter" || event.name === "space") {
      event.preventDefault();
      event.stopPropagation();
      beginFirstLesson();
    }
  };

  const ready = () => courseReady();
  const error = () => courseInitError();
  const buttonText = () => {
    if (error()) return "重新准备课程";
    return ready() ? "开始第一课" : "正在准备课程…";
  };

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={OpenCodeTheme.background}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <box
        borderStyle="single"
        borderColor={OpenCodeTheme.border}
        padding={2}
        width={60}
        flexDirection="column"
        backgroundColor={OpenCodeTheme.backgroundPanel}
      >
        <text fg={OpenCodeTheme.primary} attributes={TextAttributes.BOLD}>
          {`🎓 欢迎，${user().name}！`}
        </text>
        <text fg={OpenCodeTheme.text}>你的 Git 身份已保存，练习将在隔离沙箱中进行。</text>
        <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
          第一课会带你配置 Git 的用户名和邮箱；真实电脑上的 Git 配置不会被修改。
        </text>
        {error() ? <text fg={OpenCodeTheme.error}>{`⚠ 准备失败：${error()}`}</text> : null}
        <box marginTop={1} flexDirection="row" justifyContent="flex-end">
          <box
            ref={(el) => (startButton = el as BoxRenderable)}
            paddingX={2}
            backgroundColor={ready() || error() ? OpenCodeTheme.primary : OpenCodeTheme.selection}
            focusable
            onMouseDown={beginFirstLesson}
            onKeyDown={onKeyDown}
          >
            <text
              fg={ready() || error() ? OpenCodeTheme.background : OpenCodeTheme.textMuted}
              attributes={TextAttributes.BOLD}
            >
              {buttonText()}
            </text>
          </box>
        </box>
        <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
          {ready() ? "按 Enter 或点击按钮开始。" : "正在创建练习仓库，请稍候。"}
        </text>
      </box>
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
export function Root() {
  // screen() 必须位于 JSX 子节点中，交给 Solid 编译器创建响应式插槽；
  // 在组件顶层直接 return 三元表达式只会在首次挂载时读取一次信号。
  return (
    <box width="100%" height="100%" flexDirection="column">
      {screen() === "login" ? (
        <LoginScreen onComplete={enterCourse} />
      ) : screen() === "welcome" ? (
        <WelcomeScreen />
      ) : (
        <App />
      )}
    </box>
  );
}

// ── 登录 → 主课程 的衔接 ──────────────────────────────────

/**
 * 落盘用户身份并初始化课程引擎（不含 UI 状态设置与屏幕切换）。
 * 供 prepareCourse（测试入口）与 enterCourse（UI 入口）复用，避免逻辑重复。
 */
async function initCourseBackend(u: SavedConfig["user"]): Promise<void> {
  const updated = await updateConfig((config) => ({ ...config, user: u }));
  setCommandHistory(updated.commandHistory);
  await initEngine({
    user: u,
    completed: updated.completedLessons,
    onComplete: createCompletionSaver(),
  });
}

/** 串行保存进度，确保每一次完成都基于最新快照并已写入磁盘。 */
function createCompletionSaver(): (lessonId: string) => Promise<void> {
  return async (lessonId: string) => {
    await updateConfig((config) => markLessonComplete(config, lessonId));
  };
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
 * 登录完成回调：立即进入稳定的课程准备页；引擎在后台初始化，准备完毕后
 * 由学习者确认进入第一课，避免欢迎内容被首关任务自动滚走。
 */
export async function enterCourse(u: SavedConfig["user"]): Promise<void> {
  setUser(u);
  addMessage("system", `👋 欢迎，${u.name}！我们开始学习吧。输入 /lessons 查看全部课程。`);
  setScreen("welcome");
  startCourseSetup(u);
}

// ── 入口 ──────────────────────────────────────────────────

// 全局复用同一个 CliRenderer：登录界面与主课程界面共享 stdin/stdout，
// 避免切换时再次 createCliRenderer 触发 "stdin is already used" 错误。
let renderer: CliRenderer | undefined;
let signalHandlersInstalled = false;

async function getRenderer(): Promise<CliRenderer> {
  if (!renderer || renderer.isDestroyed) {
    renderer = await createCliRenderer({ useMouse: true });
  }
  return renderer;
}

export default App;

async function stopTui(exitCode: number): Promise<void> {
  await shutdownEngine();
  renderer?.destroy();
  process.exit(exitCode);
}

function installSignalHandlers(): void {
  if (signalHandlersInstalled) return;
  signalHandlersInstalled = true;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void stopTui(0);
    });
  }
}

export async function startTui() {
  let cfg: SavedConfig;
  try {
    cfg = await loadConfig();
  } catch {
    cfg = defaultConfig();
  }
  setCommandHistory(cfg.commandHistory);
  const r = await getRenderer();
  installSignalHandlers();
  if (hasIdentity(cfg)) {
    setUser(cfg.user);
    setScreen("course"); // 有身份：Root 首次渲染即主课程界面
    try {
      await initEngine({
        user: cfg.user,
        completed: cfg.completedLessons,
        onComplete: createCompletionSaver(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage("system", `⚠ 课程初始化失败：${msg}`);
    }
  }
  // 对同一 renderer 只 render 一次；后续屏幕切换全部经由 screen 信号
  try {
    await render(() => <Root />, r);
  } finally {
    await shutdownEngine();
  }
}
