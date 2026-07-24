/**
 * 关卡能力策略
 *
 * 每个关卡只开放必要的 Git 子命令和选项；全局危险参数一律拒绝。
 */

import type { ParsedCommand } from "./command_parser";

export class PolicyViolation extends Error {}

/** 无论关卡如何配置都必须拒绝的子命令级参数 */
const GLOBALLY_FORBIDDEN_FLAGS = new Set([
  "-C",
  "-c",
  "--config-env",
  "--git-dir",
  "--work-tree",
  "--namespace",
  "--exec-path",
  "--super-prefix",
  "--upload-pack",
  "--receive-pack",
  "--exec",
]);

/** 携带外部命令执行风险的 `--key=value` 形式前缀 */
const FORBIDDEN_FLAG_PREFIXES = [
  "--git-dir=",
  "--work-tree=",
  "--namespace=",
  "--exec-path=",
  "--config-env=",
  "--upload-pack=",
  "--receive-pack=",
  "--exec=",
];

/** 危险子命令：任何关卡都不开放 */
const FORBIDDEN_SUBCOMMANDS = new Set([
  "daemon",
  "shell",
  "upload-pack",
  "receive-pack",
  "upload-archive",
  "credential",
  "credential-cache",
  "credential-store",
  "svn",
  "p4",
  "instaweb",
  "web--browse",
]);

/** 关卡能力配置 */
export interface CapabilityPolicy {
  /** 允许的 git 子命令 */
  commands: string[];
  /** 每个子命令额外禁止的选项（可选） */
  deniedFlags?: Record<string, string[]>;
}

/** 面向自由练习的宽松策略（仍然拒绝全局危险参数） */
export const OPEN_POLICY: CapabilityPolicy = {
  commands: [
    "init",
    "clone",
    "config",
    "help",
    "status",
    "add",
    "commit",
    "diff",
    "log",
    "show",
    "restore",
    "reset",
    "revert",
    "rm",
    "mv",
    "tag",
    "branch",
    "checkout",
    "switch",
    "merge",
    "rebase",
    "cherry-pick",
    "fetch",
    "pull",
    "push",
    "remote",
    "stash",
    "reflog",
    "bisect",
    "blame",
    "grep",
    "clean",
    "describe",
    "shortlog",
    "ls-files",
    "ls-tree",
    "cat-file",
    "rev-parse",
    "rev-list",
    "hash-object",
    "update-ref",
    "symbolic-ref",
    "for-each-ref",
    "count-objects",
    "fsck",
    "gc",
    "prune",
    "notes",
    "archive",
    "bundle",
    "worktree",
    "sparse-checkout",
    "apply",
    "format-patch",
    "am",
    "range-diff",
    "mergetool",
    "difftool",
    "submodule",
    "gitk",
    "var",
    "verify-commit",
    "verify-tag",
    "write-tree",
    "read-tree",
    "commit-tree",
    "update-index",
    "check-ignore",
    "check-attr",
    "mktag",
    "mktree",
    "pack-refs",
    "replace",
    "show-ref",
    "show-branch",
    "whatchanged",
    "maintenance",
  ],
};

/** 校验一条已解析命令是否被策略允许；违规时抛出 PolicyViolation */
export function enforcePolicy(cmd: ParsedCommand, policy: CapabilityPolicy): void {
  if (FORBIDDEN_SUBCOMMANDS.has(cmd.subcommand)) {
    throw new PolicyViolation(`子命令 '${cmd.subcommand}' 出于安全原因不可用。`);
  }
  if (cmd.subcommand.startsWith("-")) {
    throw new PolicyViolation(
      `不支持 git 全局选项 '${cmd.subcommand}'。请直接使用子命令，例如 git status。`,
    );
  }
  if (!policy.commands.includes(cmd.subcommand)) {
    throw new PolicyViolation(
      `当前关卡未开放 'git ${cmd.subcommand}'。输入 /status 查看当前目标，或输入 /hint 获取提示。`,
    );
  }

  const denied = new Set(policy.deniedFlags?.[cmd.subcommand] ?? []);

  for (const arg of cmd.args) {
    if (GLOBALLY_FORBIDDEN_FLAGS.has(arg)) {
      throw new PolicyViolation(`参数 '${arg}' 出于安全原因被拒绝。`);
    }
    for (const prefix of FORBIDDEN_FLAG_PREFIXES) {
      if (arg.startsWith(prefix)) {
        throw new PolicyViolation(`参数 '${arg}' 出于安全原因被拒绝。`);
      }
    }
    if (denied.has(arg)) {
      throw new PolicyViolation(`当前关卡不允许使用 '${arg}'。`);
    }
    // config 子命令的额外限制：拒绝 shell alias 和外部命令配置
    if (cmd.subcommand === "config") {
      enforceConfigRestrictions(arg);
    }
  }
}

/** 拒绝 alias.*=!…、core.sshCommand 等外部命令配置 */
const DANGEROUS_CONFIG_KEYS = [
  "core.sshcommand",
  "core.fsmonitor",
  "core.editor",
  "core.pager",
  "core.hookspath",
  "core.askpass",
  "gpg.program",
  "credential.helper",
  "http.proxy",
  "protocol.ext.allow",
  "uploadpack.allowanysha1inwant",
  "sendemail.smtpserver",
  "diff.external",
  "merge.tool",
  "mergetool.",
  "difftool.",
  "filter.",
];

function enforceConfigRestrictions(arg: string): void {
  const lower = arg.toLowerCase();
  for (const key of DANGEROUS_CONFIG_KEYS) {
    if (lower === key || lower.startsWith(key)) {
      throw new PolicyViolation(`配置项 '${arg}' 涉及外部命令执行，课程内不允许设置。`);
    }
  }
  // alias.xxx=!cmd 形式：alias 值以 ! 开头会执行 shell 命令
  if (lower.startsWith("alias.")) {
    const eq = arg.indexOf("=");
    if (
      eq !== -1 &&
      arg
        .slice(eq + 1)
        .trimStart()
        .startsWith("!")
    ) {
      throw new PolicyViolation("不允许设置以 '!' 开头的 shell alias。");
    }
  }
}

/** 校验 alias 值本身（用于 git config alias.x '!cmd' 分离参数的场景） */
export function enforceAliasValue(key: string, value: string): void {
  if (key.toLowerCase().startsWith("alias.") && value.trimStart().startsWith("!")) {
    throw new PolicyViolation("不允许设置以 '!' 开头的 shell alias。");
  }
}
