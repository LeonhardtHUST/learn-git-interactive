/**
 * 实验仓库 fixture 构建器
 *
 * 按关卡的 setup.fixture 步骤在沙箱内搭建初始仓库状态。
 * 所有 Git 操作运行在隔离环境中。
 */

import { mkdir, rm, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureStep } from "../course/schema";
import { execGit } from "../git/runner";
import type { SessionPaths } from "./session";

/** 将 Windows 路径转为 git 可用的正斜杠形式 */
function slash(p: string): string {
  return p.replaceAll("\\", "/");
}

export interface FixtureResult {
  /** learner 仓库路径 */
  learnerRepo: string;
}

/**
 * 构建关卡 fixture。
 * learner 仓库固定位于 <session>/repos/learner；
 * bare remote 位于 <session>/remotes/<name>.git；
 * 协作者 clone 位于 <session>/repos/<name>。
 */
export async function buildFixture(
  session: SessionPaths,
  steps: FixtureStep[],
): Promise<FixtureResult> {
  // 每次构建前清空旧仓库，保证可重入（/reset）
  await rm(session.repos, { recursive: true, force: true });
  await rm(session.remotes, { recursive: true, force: true });
  await mkdir(session.repos, { recursive: true });
  await mkdir(session.remotes, { recursive: true });

  return await applySteps(session, steps);
}

/**
 * 在已有沙箱状态上执行步骤（不清空）。
 * 用于契约测试回放关卡 solution。
 */
export async function applySteps(
  session: SessionPaths,
  steps: FixtureStep[],
): Promise<FixtureResult> {
  const learner = session.learnerRepo;

  const run = async (cwd: string, args: string[]) => {
    const result = await execGit(args, { cwd, session });
    if (!result.ok) {
      throw new Error(`fixture 步骤失败：git ${args.join(" ")}\n${result.stderr}`);
    }
    return result;
  };

  for (const step of steps) {
    switch (step.action) {
      case "init": {
        await mkdir(learner, { recursive: true });
        await run(learner, ["init"]);
        break;
      }
      case "write": {
        const target = join(learner, step.path);
        await mkdir(join(target, ".."), { recursive: true });
        await Bun.write(target, step.content);
        break;
      }
      case "append": {
        const target = join(learner, step.path);
        const file = Bun.file(target);
        const prev = (await file.exists()) ? await file.text() : "";
        await Bun.write(target, prev + step.content);
        break;
      }
      case "remove": {
        await unlink(join(learner, step.path)).catch(() => {});
        break;
      }
      case "git": {
        await run(learner, step.args);
        break;
      }
      case "git_try": {
        // 允许失败（如刻意触发冲突的 merge/rebase/pull）
        await execGit(step.args, { cwd: learner, session });
        break;
      }
      case "bare_remote": {
        const bare = join(session.remotes, `${step.name}.git`);
        await run(session.remotes, ["init", "--bare", slash(bare)]);
        await run(learner, ["remote", "add", step.name, slash(bare)]);
        break;
      }
      case "clone_as": {
        const bare = join(session.remotes, "origin.git");
        const target = join(session.repos, step.name);
        await run(session.repos, ["clone", slash(bare), slash(target)]);
        break;
      }
      case "git_in": {
        const repo = join(session.repos, step.repo);
        await run(repo, step.args);
        break;
      }
      case "write_in": {
        const target = join(session.repos, step.repo, step.path);
        await mkdir(join(target, ".."), { recursive: true });
        await Bun.write(target, step.content);
        break;
      }
    }
  }

  return { learnerRepo: learner };
}
