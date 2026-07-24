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
  toggleAutograde,
} from "./engine";
import { addMessage, setShowCommitGraph, setViewMode, showCommitGraph } from "./store";

/** 处理一行输入（/ 命令或 Git 命令）。返回后不再需要额外分发。 */
export async function handleInput(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (trimmed.startsWith("/")) {
    await handleSlashCommand(trimmed);
  } else {
    await runGit(trimmed);
  }
}

async function handleSlashCommand(input: string): Promise<void> {
  const [cmd, ...rest] = input.split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd) {
    case "/lessons":
      setViewMode("lessons");
      listLessons();
      return;

    case "/lesson":
    case "/goto": {
      const n = Number.parseInt(arg, 10);
      if (Number.isNaN(n)) {
        addMessage("system", "用法：/lesson <序号>，例如 /lesson 3。输入 /lessons 查看列表。");
        return;
      }
      await gotoLesson(n);
      return;
    }

    case "/next":
      await nextLesson();
      return;

    case "/prev":
    case "/back":
      await prevLesson();
      return;

    case "/grade":
    case "/check":
      await gradeCurrent();
      return;

    case "/autograde":
      toggleAutograde();
      return;

    case "/task":
      showTask();
      return;

    case "/status":
      await showStatus();
      return;

    case "/hint":
      nextHint();
      return;

    case "/reset":
      await resetCurrent();
      setShowCommitGraph(false);
      return;

    case "/graph": {
      const expanded = !showCommitGraph();
      setShowCommitGraph(expanded);
      if (expanded) addMessage("system", "📈 提交关系图已展开（随命令实时更新）。");
      return;
    }

    case "/themes":
      setViewMode("themes");
      addMessage(
        "system",
        "🎨 可用主题：\n  - 深色（默认）\n  - 浅色\n  - Tokyo Night\n  - Catppuccin\n\n（主题切换将在后续版本接入）",
      );
      return;

    case "/help":
      setViewMode("help");
      addMessage(
        "system",
        `⌨ 可用命令：

/lessons     浏览全部关卡（含完成标记）
/lesson <n>  跳转到第 n 关
/next /prev  切换到下一关 / 上一关
/task        复看当前关卡任务
/status      查看当前目标与仓库状态
/grade       手动判题
/autograde   开关自动判题（默认开）
/hint        分级提示
/reset       重建当前实验仓库
/graph       展开/收起提交关系图
/themes      主题（预留）
/help        显示此帮助
/quit        安全退出

也可直接输入 Git 命令（如 git status、git add .），命令在隔离沙箱内真实执行。`,
      );
      return;

    case "/quit":
    case "/exit":
      addMessage("system", "👋 再见！");
      setTimeout(() => process.exit(0), 600);
      return;

    default:
      addMessage("system", `未知命令：${cmd}。输入 /help 查看可用命令。`);
      return;
  }
}
