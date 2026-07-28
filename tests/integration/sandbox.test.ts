/**
 * 沙箱集成测试：真实执行 Git，验证环境隔离。
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGitEnvironment } from "../../src/git/environment";
import { execGit, runUserGitCommand } from "../../src/git/runner";
import { createSession, pruneStaleSessions, type SessionPaths } from "../../src/sandbox/session";

let base: string;
let session: SessionPaths;

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "lgi-test-"));
  session = await createSession("it-sandbox", base);
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("环境隔离", () => {
  test("环境变量不继承用户 Git/HOME", () => {
    const env = buildGitEnvironment(session);
    expect(env.HOME).toBe(session.home);
    expect(env.GIT_CONFIG_GLOBAL).toBe(session.globalGitconfig);
    expect(env.GIT_CONFIG_NOSYSTEM).toBe("1");
    expect(env.GIT_TERMINAL_PROMPT).toBe("0");
    expect(env.GNUPGHOME).toBeUndefined();
    expect(env.SSH_AUTH_SOCK).toBeUndefined();
  });

  test("git config --list --show-origin 只显示沙箱来源", async () => {
    await execGit(["init", "probe"], { cwd: session.repos, session });
    const repo = join(session.repos, "probe");
    const result = await execGit(["config", "--list", "--show-origin"], { cwd: repo, session });
    expect(result.ok).toBe(true);
    const lines = result.stdout.split("\n").filter((l) => l.startsWith("file:"));
    expect(lines.length).toBeGreaterThan(0);
    const sessionRoot = session.root.replaceAll("\\", "/").toLowerCase();
    for (const line of lines) {
      // 允许来源：沙箱内配置文件，或实验仓库自身的 .git/config（cwd 在沙箱内，显示为相对路径）
      const normalized = line
        .replaceAll("\\", "/")
        .replaceAll('"', "")
        .replace(/\/+/g, "/")
        .toLowerCase();
      const isRepoLocal = normalized.startsWith("file:.git/config");
      expect(isRepoLocal || normalized.includes(sessionRoot)).toBe(true);
    }
  });

  test("git config --global 只改写沙箱配置", async () => {
    const repo = join(session.repos, "probe");
    const result = await runUserGitCommand('git config --global user.name "沙箱学习者"', {
      cwd: repo,
      session,
    });
    expect(result.ok).toBe(true);
    const content = await Bun.file(session.globalGitconfig).text();
    expect(content).toContain("沙箱学习者");
  });
});

describe("完整用户命令流程", () => {
  test("init → add → commit 全流程", async () => {
    await execGit(["init", "flow"], { cwd: session.repos, session });
    const repo = join(session.repos, "flow");
    await Bun.write(join(repo, "README.md"), "# 你好 Git\n");

    const add = await runUserGitCommand("git add README.md", { cwd: repo, session });
    expect(add.ok).toBe(true);

    const commit = await runUserGitCommand('git commit -m "首次提交"', { cwd: repo, session });
    expect(commit.ok).toBe(true);

    const log = await runUserGitCommand("git log --oneline", { cwd: repo, session });
    expect(log.stdout).toContain("首次提交");
  });

  test("拒绝越权命令但不执行", async () => {
    const repo = join(session.repos, "flow");
    const result = await runUserGitCommand("git status --git-dir=/other", { cwd: repo, session });
    expect(result.rejected).toBeTruthy();
    expect(result.ok).toBe(false);
  });

  test("本地 bare remote 的 clone/push/fetch 正常", async () => {
    // 创建 bare 远程
    const bare = join(session.remotes, "origin.git");
    await execGit(["init", "--bare", bare.replaceAll("\\", "/")], {
      cwd: session.remotes,
      session,
    });

    const repo = join(session.repos, "flow");
    await execGit(["remote", "add", "origin", bare.replaceAll("\\", "/")], { cwd: repo, session });

    const push = await execGit(["push", "-u", "origin", "main"], { cwd: repo, session });
    expect(push.ok).toBe(true);

    const fetch = await execGit(["fetch", "origin"], { cwd: repo, session });
    expect(fetch.ok).toBe(true);
  });
});

describe("会话生命周期", () => {
  test("过期会话会被回收，最近会话保持不变", async () => {
    const lifecycleBase = await mkdtemp(join(tmpdir(), "lgi-prune-"));
    try {
      const stale = await createSession("stale", lifecycleBase);
      const fresh = await createSession("fresh", lifecycleBase);
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await utimes(stale.root, old, old);

      await pruneStaleSessions(lifecycleBase);
      expect(existsSync(stale.root)).toBe(false);
      expect(existsSync(fresh.root)).toBe(true);
    } finally {
      await rm(lifecycleBase, { recursive: true, force: true });
    }
  });
});
