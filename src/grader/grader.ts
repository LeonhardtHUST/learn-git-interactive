/**
 * 仓库状态判定系统
 *
 * 用 Git plumbing/porcelain 只读查询判定实际状态，而非匹配固定命令字符串。
 * 同一目标允许多种正确命令序列。
 */

import type { Check } from "../course/schema";
import { execGit, type GitResult } from "../git/runner";
import type { SessionPaths } from "../sandbox/session";

export interface CheckResult {
  check: Check;
  passed: boolean;
  /** 未通过时的人类可读说明 */
  detail?: string;
}

export interface GradeResult {
  passed: boolean;
  results: CheckResult[];
}

export interface GraderContext {
  /** 实验仓库（learner） */
  repo: string;
  session: SessionPaths;
}

async function git(ctx: GraderContext, args: string[]): Promise<GitResult> {
  return await execGit(args, { cwd: ctx.repo, session: ctx.session });
}

async function stdout(ctx: GraderContext, args: string[]): Promise<string> {
  return (await git(ctx, args)).stdout.trim();
}

/** porcelain v2 状态行 */
async function statusLines(ctx: GraderContext): Promise<string[]> {
  const out = await stdout(ctx, ["status", "--porcelain=v2", "--untracked-files=all"]);
  return out ? out.split("\n") : [];
}

async function runCheck(ctx: GraderContext, check: Check): Promise<CheckResult> {
  const fail = (detail: string): CheckResult => ({ check, passed: false, detail });
  const pass = (): CheckResult => ({ check, passed: true });

  switch (check.type) {
    case "repo_initialized": {
      const r = await git(ctx, ["rev-parse", "--git-dir"]);
      return r.ok ? pass() : fail("当前目录还不是 Git 仓库。");
    }

    case "index_contains": {
      const tracked = await stdout(ctx, ["ls-files", "--cached", "--", check.path]);
      if (tracked) {
        const head = await git(ctx, ["rev-parse", "--verify", "HEAD"]);
        if (!head.ok) return pass(); // 无 HEAD：文件在索引即算暂存
        // 有 HEAD：要求暂存区相对 HEAD 存在该文件的变更（真正"暂存了内容"）
        const diff = await stdout(ctx, ["diff", "--cached", "--name-only", "--", check.path]);
        if (diff) return pass();
      }
      return fail(`${check.path} 尚未进入暂存区。`);
    }

    case "index_not_contains": {
      const head = await git(ctx, ["rev-parse", "--verify", "HEAD"]);
      if (head.ok) {
        const diff = await stdout(ctx, ["diff", "--cached", "--name-only", "--", check.path]);
        return diff ? fail(`${check.path} 不应出现在暂存区。`) : pass();
      }
      const r = await stdout(ctx, ["ls-files", "--cached", "--", check.path]);
      return r ? fail(`${check.path} 不应出现在暂存区。`) : pass();
    }

    case "worktree_modified": {
      const lines = await statusLines(ctx);
      const target = check.path.replaceAll("\\", "/");
      const modified = lines.some((l) => {
        const parts = l.split(" ");
        if (l.startsWith("1 ") || l.startsWith("2 ")) {
          const xy = parts[1] ?? "";
          const path = l.split(" ").slice(8).join(" ");
          return path === target && xy[1] !== ".";
        }
        return false;
      });
      return modified ? pass() : fail(`${check.path} 在工作区没有未暂存的修改。`);
    }

    case "worktree_clean": {
      const lines = await statusLines(ctx);
      const dirty = lines.filter((l) => {
        if (l.startsWith("1 ") || l.startsWith("2 ")) {
          const xy = l.split(" ")[1] ?? "";
          return xy[1] !== ".";
        }
        return l.startsWith("? ") || l.startsWith("u ");
      });
      return dirty.length === 0 ? pass() : fail("工作区还有未处理的改动。");
    }

    case "index_clean": {
      const lines = await statusLines(ctx);
      const staged = lines.filter((l) => {
        if (l.startsWith("1 ") || l.startsWith("2 ")) {
          const xy = l.split(" ")[1] ?? "";
          return xy[0] !== ".";
        }
        return false;
      });
      return staged.length === 0 ? pass() : fail("暂存区还有内容。");
    }

    case "file_exists": {
      const exists = await Bun.file(`${ctx.repo}/${check.path}`).exists();
      return exists ? pass() : fail(`文件 ${check.path} 不存在。`);
    }

    case "file_absent": {
      const exists = await Bun.file(`${ctx.repo}/${check.path}`).exists();
      return exists ? fail(`文件 ${check.path} 不应存在。`) : pass();
    }

    case "file_content": {
      const file = Bun.file(`${ctx.repo}/${check.path}`);
      if (!(await file.exists())) return fail(`文件 ${check.path} 不存在。`);
      const text = await file.text();
      return text.includes(check.contains) ? pass() : fail(`文件 ${check.path} 内容不符合要求。`);
    }

    case "file_ignored": {
      const r = await git(ctx, ["check-ignore", "-q", "--", check.path]);
      return r.exitCode === 0 ? pass() : fail(`${check.path} 没有被 .gitignore 忽略。`);
    }

    case "untracked_present": {
      const out = await stdout(ctx, [
        "ls-files",
        "--others",
        "--exclude-standard",
        "--",
        check.path,
      ]);
      return out ? pass() : fail(`${check.path} 应保持未跟踪状态。`);
    }

    case "head_commit_message": {
      const r = await git(ctx, ["log", "-1", "--format=%B"]);
      if (!r.ok) return fail("仓库还没有提交。");
      return r.stdout.includes(check.contains)
        ? pass()
        : fail(`最新提交信息中未找到「${check.contains}」。`);
    }

    case "commit_count_at_least": {
      const out = await stdout(ctx, ["rev-list", "--count", "HEAD"]);
      const n = Number.parseInt(out || "0", 10);
      return n >= check.count
        ? pass()
        : fail(`提交数量不足：需要至少 ${check.count} 个，当前 ${n} 个。`);
    }

    case "commit_message_exists": {
      const ref = check.ref ?? "HEAD";
      const r = await git(ctx, ["log", ref, "--format=%B%x00"]);
      if (!r.ok) return fail("无法读取提交历史。");
      const found = r.stdout.split("\0").some((m) => m.includes(check.contains));
      return found ? pass() : fail(`历史中没有包含「${check.contains}」的提交。`);
    }

    case "head_is_ancestor_of": {
      const r = await git(ctx, ["merge-base", "--is-ancestor", "HEAD", check.ref]);
      return r.exitCode === 0 ? pass() : fail(`HEAD 不是 ${check.ref} 的祖先。`);
    }

    case "ref_is_ancestor_of_head": {
      const r = await git(ctx, ["merge-base", "--is-ancestor", check.ref, "HEAD"]);
      return r.exitCode === 0 ? pass() : fail(`${check.ref} 不在当前分支历史中。`);
    }

    case "is_linear_history": {
      const ref = check.ref ?? "HEAD";
      const merges = await stdout(ctx, ["rev-list", "--merges", "--count", ref]);
      return merges === "0" ? pass() : fail("历史中仍存在合并提交，期望线性历史。");
    }

    case "head_has_parents": {
      const out = await stdout(ctx, ["rev-list", "--parents", "-n", "1", "HEAD"]);
      const parents = out.split(/\s+/).length - 1;
      return parents === check.count
        ? pass()
        : fail(`HEAD 应有 ${check.count} 个父提交，实际 ${parents} 个。`);
    }

    case "branch_exists": {
      const r = await git(ctx, ["show-ref", "--verify", "--quiet", `refs/heads/${check.name}`]);
      return r.exitCode === 0 ? pass() : fail(`分支 ${check.name} 不存在。`);
    }

    case "branch_absent": {
      const r = await git(ctx, ["show-ref", "--verify", "--quiet", `refs/heads/${check.name}`]);
      return r.exitCode === 0 ? fail(`分支 ${check.name} 应已被删除。`) : pass();
    }

    case "current_branch": {
      const out = await stdout(ctx, ["symbolic-ref", "--short", "-q", "HEAD"]);
      return out === check.name
        ? pass()
        : fail(`当前分支是 ${out || "(分离 HEAD)"}，期望 ${check.name}。`);
    }

    case "head_detached": {
      const r = await git(ctx, ["symbolic-ref", "-q", "HEAD"]);
      return r.exitCode === 0 ? fail("HEAD 仍指向分支，期望处于分离状态。") : pass();
    }

    case "tag_exists": {
      const r = await git(ctx, ["rev-parse", "--verify", `refs/tags/${check.name}`]);
      if (!r.ok) return fail(`标签 ${check.name} 不存在。`);
      if (check.annotated !== undefined) {
        const t = await stdout(ctx, ["cat-file", "-t", `refs/tags/${check.name}`]);
        const isAnnotated = t === "tag";
        if (check.annotated !== isAnnotated) {
          return fail(
            check.annotated ? `${check.name} 应是附注标签（-a）。` : `${check.name} 应是轻量标签。`,
          );
        }
      }
      return pass();
    }

    case "refs_equal": {
      const a = await stdout(ctx, ["rev-parse", "--verify", check.a]);
      const b = await stdout(ctx, ["rev-parse", "--verify", check.b]);
      return a && a === b ? pass() : fail(`${check.a} 与 ${check.b} 应指向同一提交。`);
    }

    case "remote_exists": {
      const out = await stdout(ctx, ["remote"]);
      return out.split("\n").includes(check.name) ? pass() : fail(`远程 ${check.name} 不存在。`);
    }

    case "upstream_set": {
      const r = await git(ctx, ["rev-parse", "--abbrev-ref", `${check.branch}@{upstream}`]);
      if (!r.ok) return fail(`分支 ${check.branch} 还没有上游。`);
      return r.stdout.trim() === check.upstream
        ? pass()
        : fail(`${check.branch} 的上游是 ${r.stdout.trim()}，期望 ${check.upstream}。`);
    }

    case "remote_branch_contains": {
      const r = await git(ctx, ["merge-base", "--is-ancestor", check.localRef, check.remoteRef]);
      return r.exitCode === 0
        ? pass()
        : fail(`${check.remoteRef} 尚未包含 ${check.localRef} 的提交（还没有推送成功？）。`);
    }

    case "conflict_present": {
      const out = await stdout(ctx, ["ls-files", "--unmerged"]);
      return out ? pass() : fail("当前没有合并冲突。");
    }

    case "no_conflict": {
      const out = await stdout(ctx, ["ls-files", "--unmerged"]);
      return out ? fail("仍存在未解决的冲突。") : pass();
    }

    case "stash_count_at_least": {
      const out = await stdout(ctx, ["stash", "list"]);
      const n = out ? out.split("\n").length : 0;
      return n >= check.count
        ? pass()
        : fail(`stash 数量不足：需要至少 ${check.count} 个，当前 ${n} 个。`);
    }

    case "reflog_contains": {
      const r = await git(ctx, ["reflog"]);
      return r.stdout.includes(check.pattern)
        ? pass()
        : fail(`reflog 中未找到「${check.pattern}」。`);
    }

    case "config_value": {
      const args =
        check.scope === "global"
          ? ["config", "--global", "--get", check.key]
          : ["config", "--get", check.key];
      const r = await git(ctx, args);
      if (!r.ok) return fail(`配置 ${check.key} 尚未设置。`);
      return r.stdout.trim() === check.value
        ? pass()
        : fail(`配置 ${check.key} 的值是 ${r.stdout.trim()}，期望 ${check.value}。`);
    }

    case "alias_defined": {
      const r = await git(ctx, ["config", "--get", `alias.${check.name}`]);
      return r.ok && r.stdout.trim() ? pass() : fail(`别名 ${check.name} 尚未定义。`);
    }

    case "object_type": {
      const t = await stdout(ctx, ["cat-file", "-t", check.object]);
      return t === check.objectType
        ? pass()
        : fail(`对象 ${check.object} 类型是 ${t || "未知"}，期望 ${check.objectType}。`);
    }
  }
}

/** 执行一个关卡的全部检查 */
export async function grade(ctx: GraderContext, checks: Check[]): Promise<GradeResult> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    results.push(await runCheck(ctx, check));
  }
  return { passed: results.every((r) => r.passed), results };
}
