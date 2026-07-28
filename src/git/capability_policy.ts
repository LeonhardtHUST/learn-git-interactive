/**
 * 关卡能力策略
 *
 * 每个关卡只开放必要的 Git 子命令和选项；全局危险参数一律拒绝。
 */

import { tokenize, type ParsedCommand } from "./command_parser";

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
  /** config 子命令的写入能力；未声明时不允许写配置 */
  config?: ConfigCapabilityPolicy;
}

/** 单个关卡允许写入的 Git 配置范围 */
export interface ConfigCapabilityPolicy {
  /** 允许写入的配置键 */
  allowedKeys: string[];
  /** 允许的写入作用域 */
  allowedScopes: Array<"global" | "local">;
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
  config: {
    allowedKeys: ["user.name", "user.email", "alias.st", "alias.last", "core.quotepath"],
    allowedScopes: ["global", "local"],
  },
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
  }

  if (cmd.subcommand === "config") enforceConfigPolicy(cmd.args, policy);
}

const CONFIG_READ_FLAGS = new Set([
  "--list",
  "--get",
  "--get-all",
  "--get-regexp",
  "--show-origin",
  "--show-scope",
]);
const CONFIG_SCOPE_FLAGS = new Set(["--global", "--local"]);

/**
 * 课程只需有限的 config 读写形式。显式解析这些形式比维护危险配置黑名单可靠：
 * 任何写入都必须落在关卡声明的键与作用域内，文件/包含/外部命令类选项自然不可达。
 */
function enforceConfigPolicy(args: string[], policy: CapabilityPolicy): void {
  const config = policy.config;
  const flags = args.filter((arg) => arg.startsWith("-"));
  const positional = args.filter((arg) => !arg.startsWith("-"));
  const scopes = flags.filter((arg) => CONFIG_SCOPE_FLAGS.has(arg));
  const readFlags = flags.filter((arg) => CONFIG_READ_FLAGS.has(arg));

  for (const flag of flags) {
    if (!CONFIG_SCOPE_FLAGS.has(flag) && !CONFIG_READ_FLAGS.has(flag)) {
      throw new PolicyViolation(`课程内不支持 git config 参数 '${flag}'。`);
    }
  }
  if (
    scopes.length > 1 ||
    readFlags.filter((flag) => !["--show-origin", "--show-scope"].includes(flag)).length > 1
  ) {
    throw new PolicyViolation("git config 参数组合无效。");
  }

  const hasReadAction = readFlags.some((flag) => !["--show-origin", "--show-scope"].includes(flag));
  if (hasReadAction || readFlags.includes("--list") || positional.length <= 1) {
    if (positional.length > 1) {
      throw new PolicyViolation("课程内只允许读取单个 Git 配置项。");
    }
    return;
  }

  if (!config) {
    throw new PolicyViolation("当前关卡不允许写入 Git 配置。");
  }
  if (positional.length !== 2) {
    throw new PolicyViolation("课程内配置写入格式为：git config --global <键> <值>。");
  }

  const scope = scopes[0];
  if (!scope || !config.allowedScopes.includes(scope.slice(2) as "global" | "local")) {
    throw new PolicyViolation("当前关卡只允许写入指定作用域的 Git 配置。");
  }

  const [key, value] = positional as [string, string];
  if (!config.allowedKeys.includes(key)) {
    throw new PolicyViolation(`当前关卡不允许写入配置项 '${key}'。`);
  }
  if (key.toLowerCase().startsWith("alias.")) enforceSafeAliasValue(key, value, policy);
}

/** alias 只能展开为当前关卡允许的内建 Git 子命令，不能进入 shell 或再次跳转 alias。 */
function enforceSafeAliasValue(key: string, value: string, policy: CapabilityPolicy): void {
  if (value.trimStart().startsWith("!")) {
    throw new PolicyViolation("不允许设置以 '!' 开头的 shell alias。");
  }
  const tokens = tokenize(value);
  const subcommand = tokens[0];
  if (!subcommand || subcommand.startsWith("-") || subcommand === "config") {
    throw new PolicyViolation(`别名 '${key}' 必须指向已开放的 Git 子命令。`);
  }
  const aliasNames = policy.config?.allowedKeys
    .filter((allowed) => allowed.startsWith("alias."))
    .map((allowed) => allowed.slice("alias.".length));
  if (aliasNames?.includes(subcommand) || !policy.commands.includes(subcommand)) {
    throw new PolicyViolation(`别名 '${key}' 必须指向当前关卡已开放的真实 Git 子命令。`);
  }
  enforcePolicy({ program: "git", subcommand, args: tokens.slice(1) }, policy);
}
