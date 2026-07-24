/**
 * TUI 命令处理器
 *
 * 处理 / 命令，与 UI 状态解耦。
 */

import { addMessage, setShowCommitGraph, setViewMode, showCommitGraph } from "./store";

export function handleCommand(cmd: string): boolean {
  const trimmed = cmd.trim();

  switch (trimmed) {
    case "/course":
      addMessage("system", "📚 当前学习路线：Git 基础（《Pro Git》第 1～3 章核心）");
      addMessage("system", "输入 /lessons 查看章节和关卡列表。");
      return true;

    case "/lessons":
      setViewMode("lessons");
      addMessage(
        "system",
        `📋 课程章节：

第 1 章：起步
  1.1 关于版本控制
  1.2 Git 简史
  1.3 安装与配置
  1.4 初次运行前的配置
  1.5 获取帮助

第 2 章：Git 基础
  2.1 获取仓库
  2.2 记录更新
  2.3 查看提交历史
  2.4 撤消操作
  2.5 远程仓库
  2.6 标签

第 3 章：Git 分支
  3.1 分支简介
  3.2 分支与合并
  3.3 分支管理
  3.4 分支工作流
  3.5 远程分支
  3.6 变基

输入 /lessons <编号> 可开始关卡（如 /lessons 1.3）`,
      );
      return true;

    case "/status":
      addMessage(
        "system",
        `📊 仓库状态：
  分支：main
  HEAD：9413c0c Initial commit
  工作区：干净
  暂存区：干净
  远程：origin/main ↑0 ↓0`,
      );
      return true;

    case "/hint":
      addMessage(
        "hint",
        "💡 提示：尝试使用 git status 查看当前仓库状态，或使用 git help 获取帮助。",
      );
      return true;

    case "/explain":
      addMessage("system", "没有最近执行的 Git 命令可供解释。请先输入一个 Git 命令试试！");
      return true;

    case "/graph": {
      const expanded = !showCommitGraph();
      setShowCommitGraph(expanded);
      if (expanded) {
        addMessage("system", "📈 提交图已展开（当前仅有初始提交，更多提交后会有更丰富的图）");
      }
      return true;
    }

    case "/reset":
      addMessage("system", "🔄 实验仓库已重置。当前关卡进度保留。");
      addMessage("system", "工作区和暂存区已恢复干净状态。");
      setShowCommitGraph(false);
      return true;

    case "/sessions":
      addMessage("system", "💾 暂无学习会话记录。退出后会自动保存当前进度。");
      return true;

    case "/themes":
      setViewMode("themes");
      addMessage(
        "system",
        "🎨 可用主题：\n  - 深色（默认）\n  - 浅色\n  - Tokyo Night\n  - Catppuccin\n\n输入主题名称切换。",
      );
      return true;

    case "/help":
      setViewMode("help");
      addMessage(
        "system",
        `⌨ 可用命令：

/course    选择学习路线
/lessons   浏览章节和关卡
/status    显示当前目标和仓库状态
/hint      分级给出提示
/explain   解释最近一次命令及其输出
/graph     展开/收起提交关系图
/reset     仅重建当前实验仓库
/sessions  恢复学习会话
/themes    切换主题
/help      显示此帮助
/quit      安全退出

默认快捷键：/ 打开命令补全，Tab 补全，Esc 关闭弹窗

你也可以直接输入 Git 命令（如 git status）。`,
      );
      return true;

    case "/quit":
      addMessage("system", "👋 再见！");
      // 延迟让用户看到消息
      setTimeout(() => process.exit(0), 1000);
      return true;

    default:
      return false; // 不是命令
  }
}

export function handleGitCommand(cmd: string) {
  addMessage("user", `$ ${cmd}`);
  // Phase 3: 模拟 Git 输出
  const simulated: Record<string, string> = {
    "git status": "On branch main\nnothing to commit, working tree clean",
    "git log":
      "commit 9413c0c (HEAD -> main, origin/main)\nAuthor: Leon\nDate:   Thu Jul 24 2026\n\n    Initial commit",
    "git branch": "* main",
    "git diff": "",
    "git help": "usage: git [--version] [--help] ...",
  };
  const output = simulated[cmd] ?? `git: '${cmd.split(" ")[1]}' is not a git command.`;
  addMessage("git-output", output);
}
