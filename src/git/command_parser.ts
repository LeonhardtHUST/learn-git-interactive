/**
 * 用户命令词法解析
 *
 * 课程不会将用户输入交给 shell。这里做纯词法切分：
 * 用户输入 → 词法解析 → 能力策略 → 路径边界检查 → 参数数组 → Git
 */

export interface ParsedCommand {
  /** 应为 "git" */
  program: string;
  /** git 子命令（如 status、add） */
  subcommand: string;
  /** 子命令之后的全部参数（原样保序） */
  args: string[];
}

export class ParseError extends Error {}

/**
 * 将一行输入切分为词元。
 * 支持双引号、单引号和反斜杠转义；**不支持**任何 shell 展开
 * （管道、重定向、变量、通配符都按普通字符或直接拒绝处理）。
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < input.length && '"\\'.includes(input[i + 1] as string)) {
        current += input[++i];
      } else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasToken = true;
      continue;
    }
    if (ch === "\\" && i + 1 < input.length) {
      current += input[++i];
      hasToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasToken || current.length > 0) {
        tokens.push(current);
        current = "";
        hasToken = false;
      }
      continue;
    }
    current += ch;
    hasToken = true;
  }

  if (quote !== null) throw new ParseError("引号未闭合。");
  if (hasToken || current.length > 0) tokens.push(current);
  return tokens;
}

/** shell 元字符：出现在词元中时直接拒绝，防止用户误以为支持 shell 语法 */
const SHELL_META = /[|&;<>`$(){}\n]/;

/** 解析一行用户输入为 Git 命令 */
export function parseGitCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) throw new ParseError("请输入命令。");

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new ParseError("请输入命令。");

  for (const token of tokens) {
    if (SHELL_META.test(token)) {
      throw new ParseError(
        `不支持 shell 语法：'${token}'。本课程只执行单条 Git 命令，不经过 shell。`,
      );
    }
  }

  const program = tokens[0] as string;
  if (program !== "git") {
    throw new ParseError(`只支持 git 命令（收到：'${program}'）。`);
  }
  if (tokens.length < 2) {
    throw new ParseError("请输入 git 子命令，例如 git status。");
  }

  // git 与子命令之间不允许出现全局选项（-C、-c 等），由能力策略统一拒绝
  const subcommand = tokens[1] as string;
  return { program, subcommand, args: tokens.slice(2) };
}
