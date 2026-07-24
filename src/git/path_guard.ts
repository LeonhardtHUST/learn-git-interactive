/**
 * 路径边界检查
 *
 * 所有路径参数拒绝绝对路径、`..` 逃逸；执行前解析符号链接确保仍在仓库边界内。
 */

import { realpathSync } from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";

export class PathViolation extends Error {}

/** Windows 盘符或 UNC 路径 */
const WINDOWS_ABSOLUTE = /^([a-zA-Z]:[\\/]|\\\\|\/\/)/;

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
export function assertSafeCommandPaths(args: string[]): void {
  let afterDoubleDash = false;
  for (const arg of args) {
    if (arg === "--") {
      afterDoubleDash = true;
      continue;
    }
    if (!afterDoubleDash && looksLikeOption(arg)) {
      // 检查 --xx=path 形式中的路径部分
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        const value = arg.slice(eq + 1);
        if (isAbsolute(value) || WINDOWS_ABSOLUTE.test(value)) {
          throw new PathViolation(`不允许绝对路径：'${arg}'。`);
        }
      }
      continue;
    }
    // 范围/ref 语法（main..dev、HEAD~2、a...b）放行，不视为路径逃逸
    if (/^[^/\\]*\.\.\.?[^/\\]*$/.test(arg) && !arg.includes(sep) && !arg.includes("/")) {
      continue;
    }
    assertSafeRelativePath(arg);
  }
}

/**
 * 运行时最后防线：确认解析符号链接后的目标仍在仓库内。
 * 在文件已存在时调用（如 add/restore 目标）。
 */
export function assertInsideRepo(repoRoot: string, candidate: string): void {
  const rootReal = realpathSync(repoRoot);
  const target = resolve(join(rootReal, candidate));
  let targetReal = target;
  try {
    targetReal = realpathSync(target);
  } catch {
    // 文件尚不存在：检查其字面路径即可
  }
  const rel = targetReal.startsWith(rootReal + sep) || targetReal === rootReal;
  if (!rel) {
    throw new PathViolation(`路径 '${candidate}' 解析后超出实验仓库边界。`);
  }
}
