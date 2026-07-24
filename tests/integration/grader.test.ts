/**
 * 判题引擎集成测试：真实仓库状态判定。
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execGit } from "../../src/git/runner";
import { grade, type GraderContext } from "../../src/grader/grader";
import { buildFixture } from "../../src/sandbox/fixtures";
import { createSession, type SessionPaths } from "../../src/sandbox/session";

let base: string;
let session: SessionPaths;
let ctx: GraderContext;

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "lgi-grader-"));
  session = await createSession("it-grader", base);
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("状态判定", () => {
  test("staging 场景：index_contains 与 worktree_modified", async () => {
    const { learnerRepo } = await buildFixture(session, [
      { action: "init" },
      { action: "write", path: "README.md", content: "# 项目\n" },
      { action: "write", path: "notes.txt", content: "笔记\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "初始状态"] },
      { action: "append", path: "README.md", content: "新内容\n" },
      { action: "append", path: "notes.txt", content: "更多笔记\n" },
    ]);
    ctx = { repo: learnerRepo, session };

    // 未暂存前：判题不通过
    let result = await grade(ctx, [
      { type: "index_contains", path: "README.md" },
      { type: "worktree_modified", path: "notes.txt" },
    ]);
    expect(result.passed).toBe(false);

    // 只暂存 README.md：通过（多种命令序列均可，这里用 add）
    await execGit(["add", "README.md"], { cwd: learnerRepo, session });
    result = await grade(ctx, [
      { type: "index_contains", path: "README.md" },
      { type: "worktree_modified", path: "notes.txt" },
    ]);
    expect(result.passed).toBe(true);
  });

  test("分支与合并场景", async () => {
    const { learnerRepo } = await buildFixture(session, [
      { action: "init" },
      { action: "write", path: "a.txt", content: "a\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "第一个提交"] },
      { action: "git", args: ["branch", "feature"] },
    ]);
    ctx = { repo: learnerRepo, session };

    const result = await grade(ctx, [
      { type: "branch_exists", name: "feature" },
      { type: "current_branch", name: "main" },
      { type: "commit_count_at_least", count: 1 },
      { type: "head_commit_message", contains: "第一个提交" },
    ]);
    expect(result.passed).toBe(true);
  });

  test("合并提交判定：head_has_parents", async () => {
    const { learnerRepo } = await buildFixture(session, [
      { action: "init" },
      { action: "write", path: "base.txt", content: "base\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "基础"] },
      { action: "git", args: ["switch", "-c", "feature"] },
      { action: "write", path: "f.txt", content: "f\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "功能"] },
      { action: "git", args: ["switch", "main"] },
      { action: "write", path: "m.txt", content: "m\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "主线"] },
      { action: "git", args: ["merge", "feature", "-m", "合并 feature"] },
    ]);
    ctx = { repo: learnerRepo, session };

    const result = await grade(ctx, [
      { type: "head_has_parents", count: 2 },
      { type: "ref_is_ancestor_of_head", ref: "feature" },
      { type: "no_conflict" },
    ]);
    expect(result.passed).toBe(true);
  });

  test("冲突场景：conflict_present", async () => {
    const { learnerRepo } = await buildFixture(session, [
      { action: "init" },
      { action: "write", path: "conflict.txt", content: "原始\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "起点"] },
      { action: "git", args: ["switch", "-c", "other"] },
      { action: "write", path: "conflict.txt", content: "other 版本\n" },
      { action: "git", args: ["commit", "-am", "other 修改"] },
      { action: "git", args: ["switch", "main"] },
      { action: "write", path: "conflict.txt", content: "main 版本\n" },
      { action: "git", args: ["commit", "-am", "main 修改"] },
    ]);
    ctx = { repo: learnerRepo, session };

    // 触发冲突（merge 预期失败，直接执行）
    await execGit(["merge", "other"], { cwd: learnerRepo, session });

    const result = await grade(ctx, [{ type: "conflict_present" }]);
    expect(result.passed).toBe(true);
  });

  test("远程场景：upstream 与 remote_branch_contains", async () => {
    const { learnerRepo } = await buildFixture(session, [
      { action: "init" },
      { action: "write", path: "r.txt", content: "r\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "远程测试"] },
      { action: "bare_remote", name: "origin" },
      { action: "git", args: ["push", "-u", "origin", "main"] },
    ]);
    ctx = { repo: learnerRepo, session };

    const result = await grade(ctx, [
      { type: "remote_exists", name: "origin" },
      { type: "upstream_set", branch: "main", upstream: "origin/main" },
      { type: "remote_branch_contains", remoteRef: "origin/main", localRef: "main" },
    ]);
    expect(result.passed).toBe(true);
  });

  test("标签与配置场景", async () => {
    const { learnerRepo } = await buildFixture(session, [
      { action: "init" },
      { action: "write", path: "t.txt", content: "t\n" },
      { action: "git", args: ["add", "."] },
      { action: "git", args: ["commit", "-m", "打标签"] },
      { action: "git", args: ["tag", "-a", "v1.0", "-m", "第一个版本"] },
      { action: "git", args: ["tag", "lightweight"] },
      { action: "git", args: ["config", "--global", "alias.st", "status"] },
    ]);
    ctx = { repo: learnerRepo, session };

    const result = await grade(ctx, [
      { type: "tag_exists", name: "v1.0", annotated: true },
      { type: "tag_exists", name: "lightweight", annotated: false },
      { type: "alias_defined", name: "st" },
      { type: "object_type", object: "HEAD", objectType: "commit" },
      { type: "object_type", object: "refs/tags/v1.0", objectType: "tag" },
    ]);
    expect(result.passed).toBe(true);
  });

  test("失败时返回可读说明", async () => {
    const { learnerRepo } = await buildFixture(session, [{ action: "init" }]);
    ctx = { repo: learnerRepo, session };

    const result = await grade(ctx, [{ type: "branch_exists", name: "ghost" }]);
    expect(result.passed).toBe(false);
    expect(result.results[0]?.detail).toContain("ghost");
  });
});
