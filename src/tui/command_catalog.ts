export interface SlashCommandDefinition {
  /** 规范命令名；分发逻辑以此为准。 */
  id: string;
  /** 可输入的所有命令名（含别名）。 */
  names: string[];
  /** /help 中显示的用法。 */
  usage: string;
  description: string;
}

export const SLASH_COMMANDS: readonly SlashCommandDefinition[] = [
  {
    id: "lessons",
    names: ["/lessons"],
    usage: "/lessons",
    description: "浏览全部关卡（含完成标记）",
  },
  { id: "lesson", names: ["/lesson", "/goto"], usage: "/lesson <n>", description: "跳转到第 n 关" },
  { id: "next", names: ["/next"], usage: "/next", description: "切换到下一关" },
  { id: "prev", names: ["/prev", "/back"], usage: "/prev", description: "切换到上一关" },
  { id: "grade", names: ["/grade", "/check"], usage: "/grade", description: "手动判题" },
  {
    id: "autograde",
    names: ["/autograde"],
    usage: "/autograde",
    description: "开关自动判题（默认开）",
  },
  { id: "task", names: ["/task"], usage: "/task", description: "复看当前关卡任务" },
  { id: "status", names: ["/status"], usage: "/status", description: "查看当前目标与仓库状态" },
  { id: "hint", names: ["/hint"], usage: "/hint", description: "分级提示" },
  {
    id: "write",
    names: ["/write"],
    usage: "/write <文件名> <内容>",
    description: "写入实验仓库内的文件",
  },
  { id: "reset", names: ["/reset"], usage: "/reset", description: "重建当前实验仓库" },
  { id: "graph", names: ["/graph"], usage: "/graph", description: "展开/收起提交关系图" },
  { id: "themes", names: ["/themes"], usage: "/themes", description: "主题（预留）" },
  { id: "help", names: ["/help"], usage: "/help", description: "显示此帮助" },
  { id: "quit", names: ["/quit", "/exit"], usage: "/quit", description: "安全退出" },
];

export function findSlashCommand(name: string): SlashCommandDefinition | undefined {
  return SLASH_COMMANDS.find((command) => command.names.includes(name));
}

export function slashCompletionCandidates(input: string): string[] {
  const prefix = input.trimStart().toLowerCase();
  if (!prefix.startsWith("/") || /\s/.test(prefix)) return [];
  return SLASH_COMMANDS.flatMap((command) => command.names)
    .filter((name) => name.startsWith(prefix))
    .sort();
}

export function helpText(): string {
  const lines = SLASH_COMMANDS.map(
    (command) => `${command.usage.padEnd(20)} ${command.description}`,
  );
  return `⌨ 可用命令：\n\n${lines.join("\n")}\n\n也可直接输入 Git 命令（如 git status、git add .），命令在隔离沙箱内真实执行。`;
}
