/**
 * 受限 Git 命令执行器
 *
 * 用户输入 → 词法解析 → 能力策略 → 路径边界检查 → Bun.spawn 参数数组 → Git
 * 全程不经过 shell。
 */

import type { SessionPaths } from "../sandbox/session";
import {
  type CapabilityPolicy,
  enforcePolicy,
  OPEN_POLICY,
  PolicyViolation,
} from "./capability_policy";
import { ParseError, parseGitCommand } from "./command_parser";
import { buildGitEnvironment } from "./environment";
import { findGitExecutable } from "./executable";
import { assertSafeCommandPaths, PathViolation } from "./path_guard";

export interface GitResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  /** 拒绝原因（策略/解析/路径违规时非空，此时命令未执行） */
  rejected?: string;
}

export interface RunOptions {
  /** 工作目录（实验仓库） */
  cwd: string;
  /** 会话路径（用于环境隔离） */
  session: SessionPaths;
  /** 关卡能力策略；缺省用宽松策略 */
  policy?: CapabilityPolicy;
  /** 超时毫秒数 */
  timeoutMs?: number;
}

/** 沙箱内强制附加的每命令配置（禁用 hook、credential helper 等） */
function hardeningFlags(session: SessionPaths): string[] {
  return [
    "-c",
    `core.hooksPath=${session.hooksDisabled}`,
    "-c",
    "credential.helper=",
    "-c",
    "core.pager=cat",
    "-c",
    "core.editor=true",
    "-c",
    "protocol.ext.allow=never",
    "-c",
    "protocol.http.allow=never",
    "-c",
    "protocol.https.allow=never",
    "-c",
    "protocol.git.allow=never",
    "-c",
    "protocol.ssh.allow=never",
    "-c",
    "protocol.file.allow=always",
  ];
}

/**
 * 解析并执行一行用户 Git 命令。
 * 解析失败或违反策略时不执行，返回 rejected 说明。
 */
export async function runUserGitCommand(input: string, options: RunOptions): Promise<GitResult> {
  let parsed: ReturnType<typeof parseGitCommand>;
  try {
    parsed = parseGitCommand(input);
    enforcePolicy(parsed, options.policy ?? OPEN_POLICY);
    assertSafeCommandPaths(parsed.args);
  } catch (error) {
    if (
      error instanceof ParseError ||
      error instanceof PolicyViolation ||
      error instanceof PathViolation
    ) {
      return { ok: false, exitCode: -1, stdout: "", stderr: "", rejected: error.message };
    }
    throw error;
  }

  return await execGit([parsed.subcommand, ...parsed.args], options);
}

/**
 * 直接执行 Git 参数数组（供 fixture 搭建、判题器等内部代码使用，
 * 不经过用户命令策略，但同样运行在隔离环境中）。
 */
export async function execGit(args: string[], options: RunOptions): Promise<GitResult> {
  const git = findGitExecutable();
  const env = buildGitEnvironment(options.session);
  const argv = [git, ...hardeningFlags(options.session), ...args];

  const proc = Bun.spawn(argv, {
    cwd: options.cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  const timeoutMs = options.timeoutMs ?? 15_000;
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);

  return { ok: exitCode === 0, exitCode, stdout, stderr };
}
