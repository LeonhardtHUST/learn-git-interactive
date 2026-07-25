/**
 * 课程契约测试：遍历所有关卡，用其参考解法（solution）回放，
 * 验证关卡确实可通关（grade 全部通过）。
 *
 * 这是「关卡可解性」的硬性保证——任何一道关卡的 setup + solution 与 checks
 * 对不上，这里都会失败，提醒作者修正 fixture / checks / solution。
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listLessonFiles, loadLesson } from "../../src/course/loader";
import type { Lesson } from "../../src/course/schema";
import { substituteLesson } from "../../src/course/substitute";
import { applySteps, buildFixture } from "../../src/sandbox/fixtures";
import { createSession } from "../../src/sandbox/session";
import { grade, type GraderContext } from "../../src/grader/grader";

// 契约测试用一个固定的「测试用户」替换关卡内的 {{user.name}}/{{user.email}}，
// 以验证含占位符的关卡（如配置身份）确实可用真实值通关。
const TEST_USER = { name: "契约测试用户", email: "contract@example.com" };

const files = await listLessonFiles("zh-CN");
const solvable: { file: string; lesson: Lesson }[] = [];
for (const f of files) {
  const lesson = await loadLesson(f);
  if (lesson.solution && lesson.solution.length > 0) {
    solvable.push({ file: f, lesson });
  }
}

describe("课程契约：每道关卡都能用参考解法通关", () => {
  test(`共加载 ${solvable.length} 道带解法的关卡`, () => {
    expect(solvable.length).toBeGreaterThanOrEqual(18);
  });

  for (const { file, lesson } of solvable) {
    test(`${lesson.id} — ${file}`, async () => {
      const base = await mkdtemp(join(tmpdir(), "lgi-contract-"));
      const safeId = lesson.id.replace(/[^a-z0-9]/gi, "_");
      const session = await createSession(`contract_${safeId}`, base);
      try {
        // 用测试用户替换占位符，确保判题与解法使用一致的真实值
        const resolved = substituteLesson(lesson, TEST_USER);
        const { learnerRepo } = await buildFixture(session, resolved.setup.fixture);
        const solution = resolved.solution;
        if (!solution || solution.length === 0) {
          throw new Error(`关卡 ${lesson.id} 缺少参考解法（solution）。`);
        }
        await applySteps(session, solution);
        const ctx: GraderContext = { repo: learnerRepo, session };
        const result = await grade(ctx, resolved.checks);
        if (!result.passed) {
          const details = result.results
            .filter((r) => !r.passed)
            .map((r) => `  - ${JSON.stringify(r.check)}: ${r.detail ?? "未通过"}`)
            .join("\n");
          throw new Error(`关卡 ${lesson.id} 的参考解法未能通关：\n${details}`);
        }
        expect(result.passed).toBe(true);
      } finally {
        await rm(base, { recursive: true, force: true });
      }
    }, 120_000);
  }
});
