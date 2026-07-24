/**
 * Git 子进程环境变量隔离
 *
 * 每次 Git 子进程使用清理后的环境变量，不继承用户真实 Git 环境。
 * 保证 `git config --global` 等练习只修改会话内的沙箱配置。
 */

import type { SessionPaths } from "../sandbox/session";

/** 必须从子进程环境中剔除的变量（用户真实 Git/GPG/SSH 环境） */
const BLOCKED_ENV_PREFIXES = ["GIT_", "GPG_", "SSH_", "GNUPGHOME"];

const BLOCKED_ENV_EXACT = new Set([
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "EDITOR",
  "VISUAL",
  "PAGER",
  "LESS",
]);

/** 构造隔离后的 Git 子进程环境变量 */
export function buildGitEnvironment(paths: SessionPaths): Record<string, string> {
  const env: Record<string, string> = {};

  // 只保留安全的基础变量（PATH、系统标识、locale）
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    const upper = key.toUpperCase();
    if (BLOCKED_ENV_EXACT.has(upper)) continue;
    if (BLOCKED_ENV_PREFIXES.some((p) => upper.startsWith(p))) continue;
    env[key] = value;
  }

  // 指向沙箱的 Git 环境
  env.HOME = paths.home;
  env.USERPROFILE = paths.home;
  env.XDG_CONFIG_HOME = paths.xdg;
  env.GIT_CONFIG_GLOBAL = paths.globalGitconfig;
  env.GIT_CONFIG_SYSTEM = paths.systemGitconfig;
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_ATTR_GLOBAL = paths.globalGitattributes;
  env.GIT_ATTR_SYSTEM = paths.systemGitattributes;
  env.GIT_TEMPLATE_DIR = paths.template;
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_ASKPASS = "";
  env.GIT_EDITOR = "true"; // 交互式 editor 直接成功返回，避免卡死
  env.GIT_PAGER = "cat";
  env.GIT_OPTIONAL_LOCKS = "1";
  env.TMPDIR = paths.tmp;
  env.TMP = paths.tmp;
  env.TEMP = paths.tmp;
  // 稳定输出语言，便于判题与讲解
  env.LC_ALL = "C.UTF-8";
  env.LANG = "C.UTF-8";

  return env;
}
