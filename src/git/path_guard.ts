/**
 * 路径边界检查
 *
 * 所有路径参数拒绝绝对路径、`..` 逃逸；执行前解析符号链接确保仍在仓库边界内。
 */

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, normalize, relative, resolve, sep } from "node:path";

export class PathViolation extends Error {}

/** Windows 盘符或 UNC 路径 */
const WINDOWS_ABSOLUTE = /^([a-zA-Z]:[\\/]|\\\\|\/\/)/;
const URI_SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const PATH_ESCAPE = /(^|[\\/])\.\.([\\/]|$)/;

/** 判断一个词元是否形如路径参数（保守判断：非 -- 开头的都可能是路径或 ref） */
export function looksLikeOption(token: string): boolean {
  return token.startsWith("-");
}

/**
 * 校验一个用户提供的路径参数是否安全：
 * - 拒绝绝对路径（POSIX 与 Windows 两种形式）
 * - 拒绝 `..` 逃逸
 * - 拒绝空字节等异常字符
 */
export function assertSafeRelativePath(token: string): void {
  if (token.includes("\0")) {
    throw new PathViolation("路径包含非法字符。");
  }
  if (isAbsolute(token) || WINDOWS_ABSOLUTE.test(token)) {
    throw new PathViolation(`不允许绝对路径：'${token}'。请使用仓库内的相对路径。`);
  }
  if (URI_SCHEME.test(token)) {
    throw new PathViolation(`不允许外部 URI：'${token}'。请使用实验仓库内的相对路径或已配置远程。`);
  }
  const normalized = normalize(token);
  if (normalized === ".." || normalized.startsWith(`..${sep}`) || normalized.startsWith("../")) {
    throw new PathViolation(`路径 '${token}' 超出实验仓库边界。`);
  }
  // ~ 展开由 shell 完成，我们不经过 shell，但仍显式拒绝以免误解
  if (token.startsWith("~")) {
    throw new PathViolation(`不支持 '~' 路径：'${token}'。请使用仓库内的相对路径。`);
  }
}

/**
 * 对命令的全部参数做路径检查。
 * 选项（- 开头）跳过；`--` 之后的参数全部按路径处理；
 * 其余参数保守地按"可能是路径"处理（ref 名不会包含 .. 逃逸形式，检查无副作用——
 * 注意 ref 中的 `..` 范围语法如 main..dev 是合法的，需要放行）。
 */
export function assertSafeCommandPaths(args: string[], repoRoot?: string, subcommand = ""): void {
  // `git config` 的键和值都不是路径。其文件型选项由能力策略在本函数前拦截。
  if (subcommand === "config") return;

  let afterDoubleDash = false;
  let textValueFollows = false;
  for (const arg of args) {
    if (textValueFollows) {
      textValueFollows = false;
      continue;
    }
    if (arg === "--") {
      afterDoubleDash = true;
      continue;
    }
    if (!afterDoubleDash && looksLikeOption(arg)) {
      if (isTextValueOption(subcommand, arg)) {
        if (!arg.includes("=")) textValueFollows = true;
        continue;
      }
      // 检查 --xx=path 形式中的路径部分
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        const value = arg.slice(eq + 1);
        assertSafeRelativePath(value);
        assertExistingPathInsideRepo(repoRoot, value);
      } else if (URI_SCHEME.test(arg) || PATH_ESCAPE.test(arg)) {
        // 短选项可把值连写，如 -o../../outside；同样不能绕过边界。
        throw new PathViolation(`参数 '${arg}' 包含超出实验仓库边界的路径。`);
      }
      continue;
    }
    // 范围/ref 语法（main..dev、HEAD~2、a...b）放行，不视为路径逃逸
    if (/^[^/\\]*\.\.\.?[^/\\]*$/.test(arg) && !arg.includes(sep) && !arg.includes("/")) {
      continue;
    }
    assertSafeRelativePath(arg);
    assertExistingPathInsideRepo(repoRoot, arg);
  }
}

function assertExistingPathInsideRepo(repoRoot: string | undefined, candidate: string): void {
  if (!repoRoot) return;
  resolveSafePathInsideRepo(repoRoot, candidate);
}

/**
 * 运行时最后防线：确认解析符号链接后的目标仍在仓库内。
 * 在文件已存在时调用（如 add/restore 目标）。
 */
export function assertInsideRepo(repoRoot: string, candidate: string): void {
  resolveSafePathInsideRepo(repoRoot, candidate);
}

/**
 * 将一个相对路径安全地解析到实验仓库内。
 *
 * 即使最终文件尚不存在，也会从最近存在的父目录开始解析真实路径，避免
 * `repo/link/new-file` 中的 `link` 指向仓库外时绕过检查。
 */
export function resolveSafePathInsideRepo(repoRoot: string, candidate: string): string {
  assertSafeRelativePath(candidate);
  const rootReal = realpathSync(repoRoot);
  const target = resolve(rootReal, candidate);
  assertPathInside(rootReal, target, candidate);

  let existingAncestor = target;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  if (existsSync(existingAncestor)) {
    assertPathInside(rootReal, realpathSync(existingAncestor), candidate);
  }
  return target;
}

function assertPathInside(rootReal: string, target: string, candidate: string): void {
  const rel = relative(rootReal, target);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) return;
  throw new PathViolation(`路径 '${candidate}' 解析后超出实验仓库边界。`);
}

const TEXT_VALUE_OPTIONS: Readonly<Record<string, ReadonlySet<string>>> = {
  commit: new Set(["-m", "--message", "--author", "--date", "--trailer"]),
  merge: new Set(["-m", "--message", "--log"]),
  tag: new Set(["-m", "--message"]),
  notes: new Set(["-m", "--message"]),
  log: new Set([
    "--grep",
    "--author",
    "--committer",
    "--format",
    "--pretty",
    "--since",
    "--until",
    "--after",
    "--before",
  ]),
  show: new Set(["--format", "--pretty"]),
  reflog: new Set(["--format", "--pretty"]),
};

function isTextValueOption(subcommand: string, option: string): boolean {
  const options = TEXT_VALUE_OPTIONS[subcommand];
  if (!options) return false;
  const name = option.split("=", 1)[0] ?? option;
  return options.has(name);
}
