/**
 * 主 TUI 应用组件
 *
 * 五区域布局：顶栏 / 会话流 / Git 状态卡 / 提交图 / 底部输入
 */

import { TextAttributes } from "@opentui/core";
import { render } from "@opentui/solid";
import { For, Show } from "solid-js";
import { handleInput } from "./commands";
import { initEngine } from "./engine";
import {
  addMessage,
  autograde,
  commitGraph,
  gitStatus,
  inputValue,
  progress,
  type SessionMessage,
  sessionMessages,
  setInputValue,
  showCommitGraph,
  showGitStatus,
} from "./store";

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
        🎓 {progress().course}
      </text>
      <text fg="#565f89">
        {progress().chapter} | {progress().lesson}
      </text>
      <text fg="#9ece6a">
        进度 {progress().completed}/{progress().total}{" "}
        {autograde() ? "· 自动判题:开" : "· 自动判题:关"}
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
  return (
    <box paddingLeft={1} flexDirection="column">
      <text fg={style().fg}>
        {style().prefix}
        {props.msg.content}
      </text>
    </box>
  );
}

function SessionFlow() {
  return (
    <scroll-box flexGrow={1} flexDirection="column" stickyScroll stickyStart="bottom">
      <For each={sessionMessages()}>{(msg) => <MessageBubble msg={msg} />}</For>
    </scroll-box>
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
      <text fg="#c0caf5">
        分支：{gitStatus().branch} | HEAD：{gitStatus().head}
      </text>
      <text fg="#c0caf5">
        工作区：{gitStatus().workingTree} | 暂存区：{gitStatus().index}
      </text>
      <text fg="#c0caf5">远程：{gitStatus().remoteTracking}</text>
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

// ── 子组件：提交图（占位）─────────────────────────────────

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
      <Show when={showGitStatus()}>
        <GitStatusCard />
      </Show>
      <Show when={showCommitGraph()}>
        <CommitGraph />
      </Show>
      <BottomInput />
    </box>
  );
}

// ── 入口 ──────────────────────────────────────────────────

export async function startTui() {
  try {
    await initEngine();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addMessage("system", `⚠ 课程初始化失败：${msg}`);
  }
  await render(() => <App />);
}
