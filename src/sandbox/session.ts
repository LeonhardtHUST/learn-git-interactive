/**
 * 学习会话沙箱目录
 *
 * 每个学习会话在应用数据目录中拥有独立目录，Git 子进程全部指向该目录，
 * 保证课程练习不会读取或修改用户真实 Git 环境。
 */

import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/** 会话目录布局 */
export interface SessionPaths {
  /** 会话根目录 */
  root: string;
  /** 伪 HOME */
  home: string;
  /** 伪 XDG_CONFIG_HOME */
  xdg: string;
  /** 配置目录 */
  config: string;
  /** 沙箱内 global gitconfig */
  globalGitconfig: string;
  /** 沙箱内 system gitconfig */
  systemGitconfig: string;
  /** 沙箱内 global gitattributes */
  globalGitattributes: string;
  /** 沙箱内 system gitattributes */
  systemGitattributes: string;
  /** 空模板目录（禁用默认 hook 模板） */
  template: string;
  /** 禁用 hooks 的目录 */
  hooksDisabled: string;
  /** 临时目录 */
  tmp: string;
  /** 实验仓库目录 */
  repos: string;
  /** learner 仓库 */
  learnerRepo: string;
  /** 本地 bare remote 目录 */
  remotes: string;
}

/** 返回应用数据根目录（跨平台） */
export function appDataDir(): string {
  const platform = process.platform;
  if (platform === "win32") {
    const base =
      process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? ".", "AppData", "Local");
    return join(base, "learn-git-interactive");
  }
  const xdgData = process.env.XDG_DATA_HOME;
  if (xdgData) return join(xdgData, "learn-git-interactive");
  return join(process.env.HOME ?? ".", ".local", "share", "learn-git-interactive");
}

/** 计算某个会话的所有路径 */
export function sessionPaths(sessionId: string, baseDir?: string): SessionPaths {
  const root = join(baseDir ?? appDataDir(), "sessions", sessionId);
  const config = join(root, "config");
  return {
    root,
    home: join(root, "home"),
    xdg: join(root, "xdg"),
    config,
    globalGitconfig: join(config, "global.gitconfig"),
    systemGitconfig: join(config, "system.gitconfig"),
    globalGitattributes: join(config, "global.gitattributes"),
    systemGitattributes: join(config, "system.gitattributes"),
    template: join(root, "template"),
    hooksDisabled: join(root, "hooks-disabled"),
    tmp: join(root, "tmp"),
    repos: join(root, "repos"),
    learnerRepo: join(root, "repos", "learner"),
    remotes: join(root, "remotes"),
  };
}

/** 沙箱 global gitconfig 的初始内容：提供课程所需的最小安全默认值 */
const DEFAULT_GLOBAL_GITCONFIG = `# learn-git-interactive 沙箱 Git 配置
# 该文件只存在于学习会话内部，与用户真实 Git 配置完全隔离。
[user]
\tname = Git 学习者
\temail = learner@example.invalid
[init]
\tdefaultBranch = main
[core]
\tautocrlf = false
\tpager = cat
[advice]
\tdetachedHead = false
[color]
\tui = never
[commit]
\tgpgsign = false
[tag]
\tgpgsign = false
[gpg]
\tprogram = /nonexistent/gpg-disabled
[credential]
\thelper =
`;

/** 创建会话目录结构并写入初始配置 */
export async function createSession(sessionId: string, baseDir?: string): Promise<SessionPaths> {
  const paths = sessionPaths(sessionId, baseDir);
  await Promise.all([
    mkdir(paths.home, { recursive: true }),
    mkdir(paths.xdg, { recursive: true }),
    mkdir(paths.config, { recursive: true }),
    mkdir(paths.template, { recursive: true }),
    mkdir(paths.hooksDisabled, { recursive: true }),
    mkdir(paths.tmp, { recursive: true }),
    mkdir(paths.repos, { recursive: true }),
    mkdir(paths.remotes, { recursive: true }),
  ]);
  await Promise.all([
    Bun.write(paths.globalGitconfig, DEFAULT_GLOBAL_GITCONFIG),
    Bun.write(paths.systemGitconfig, "# 沙箱 system gitconfig（有意留空）\n"),
    Bun.write(paths.globalGitattributes, "# 沙箱 global gitattributes（有意留空）\n"),
    Bun.write(paths.systemGitattributes, "# 沙箱 system gitattributes（有意留空）\n"),
  ]);
  return paths;
}

/** 删除整个会话目录 */
export async function destroySession(sessionId: string, baseDir?: string): Promise<void> {
  const paths = sessionPaths(sessionId, baseDir);
  await rm(paths.root, { recursive: true, force: true });
}

/** 仅重建实验仓库目录（/reset：保留配置与进度） */
export async function resetRepos(paths: SessionPaths): Promise<void> {
  await rm(paths.repos, { recursive: true, force: true });
  await rm(paths.remotes, { recursive: true, force: true });
  await mkdir(paths.repos, { recursive: true });
  await mkdir(paths.remotes, { recursive: true });
}

/** 生成会话 ID（时间戳 + 随机） */
export function newSessionId(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}
