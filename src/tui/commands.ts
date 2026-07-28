/**
 * TUI 命令处理器
 *
 * 解析 / 命令并分发到学习引擎；非 / 开头视为 Git 命令。
 */

import {
  gotoLesson,
  gradeCurrent,
  listLessons,
  nextHint,
  nextLesson,
  prevLesson,
  resetCurrent,
  runGit,
  showStatus,
  showTask,
  shutdownEngine,
  toggleAutograde,
  writeCourseFile,
} from "./engine";
import { findSlashCommand, helpText } from "./command_catalog";
import { addMessage, setShowCommitGraph, setViewMode, showCommitGraph } from "./store";

/** 处理一行输入（/ 命令或 Git 命令）。返回后不再需要额外分发。 */
export async function handleInput(text: string): Promise<void> {
  const slashInput = text.trimStart();
  if (!slashInput) return;
  if (slashInput.startsWith("/")) {
    // /write 的内容可能含有末尾空格，不能对斜杠命令做 trimEnd。
    await handleSlashCommand(slashInput);
  } else {
    await runGit(text.trim());
  }
}

async function handleSlashCommand(input: string): Promise<void> {
  const [cmd = "", ...rest] = input.split(/\s+/);
  const arg = rest.join(" ").trim();
  const rawArgument = input.slice(cmd.length).trimStart();
  const command = findSlashCommand(cmd);

  switch (command?.id) {
    case "lessons":
      setViewMode("lessons");
      listLessons();
      return;

    case "lesson": {
      const n = Number.parseInt(arg, 10);
      if (Number.isNaN(n)) {
        addMessage("system", "用法：/lesson <序号>，例如 /lesson 3。输入 /lessons 查看列表。");
        return;
      }
      await gotoLesson(n);
      return;
    }

    case "next":
      await nextLesson();
      return;

    case "prev":
      await prevLesson();
      return;

    case "grade":
      await gradeCurrent();
      return;

    case "autograde":
      toggleAutograde();
      return;

    case "task":
      showTask();
      return;

    case "status":
      await showStatus();
      return;

    case "hint":
      nextHint();
      return;

    case "write": {
      const match = rawArgument.match(/^(\S+)(?:\s+([\s\S]*))?$/);
      if (!match || match[2] === undefined) {
        addMessage("system", "用法：/write <文件名> <内容>。文件名不能包含空格。");
        return;
      }
      await writeCourseFile(match[1] ?? "", match[2] ?? "");
      return;
    }

    case "reset":
      await resetCurrent();
      setShowCommitGraph(false);
      return;

    case "graph": {
      const expanded = !showCommitGraph();
      setShowCommitGraph(expanded);
      if (expanded) addMessage("system", "📈 提交关系图已展开（随命令实时更新）。");
      return;
    }

    case "themes":
      setViewMode("themes");
      addMessage(
        "system",
        "🎨 可用主题：\n  - 深色（默认）\n  - 浅色\n  - Tokyo Night\n  - Catppuccin\n\n（主题切换将在后续版本接入）",
      );
      return;

    case "help":
      setViewMode("help");
      addMessage("system", helpText());
      return;

    case "quit":
      addMessage("system", "👋 再见！");
      await shutdownEngine();
      process.exit(0);
      return;

    default:
      addMessage("system", `未知命令：${cmd}。输入 /help 查看可用命令。`);
      return;
  }
}
