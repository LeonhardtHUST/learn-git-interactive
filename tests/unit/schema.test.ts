import { describe, expect, test } from "bun:test";
import { CheckSchema, LessonSchema } from "../../src/course/schema";

const VALID_LESSON = {
  id: "basics.staging",
  title: "暂存一次精确的修改",
  source: { chapter: "2.2" },
  prerequisites: ["basics.init"],
  intro: "暂存区是提交前的缓冲地带。",
  task: "把 README.md 加入暂存区，让 notes.txt 留在工作区。",
  setup: {
    fixture: [{ action: "init" }, { action: "write", path: "README.md", content: "# Hi\n" }],
  },
  objectives: ["README.md 已进入暂存区", "notes.txt 仍留在工作区"],
  capabilities: { commands: ["status", "diff", "add"] },
  checks: [
    { type: "index_contains", path: "README.md" },
    { type: "worktree_modified", path: "notes.txt" },
  ],
  hints: ["先比较工作区和暂存区。", "可以只指定一个文件给 git add。"],
};

describe("LessonSchema", () => {
  test("接受合法关卡", () => {
    const result = LessonSchema.safeParse(VALID_LESSON);
    expect(result.success).toBe(true);
  });

  test("拒绝非法 id", () => {
    const bad = { ...VALID_LESSON, id: "BadId" };
    expect(LessonSchema.safeParse(bad).success).toBe(false);
  });

  test("拒绝空 checks", () => {
    const bad = { ...VALID_LESSON, checks: [] };
    expect(LessonSchema.safeParse(bad).success).toBe(false);
  });

  test("拒绝未知 check 类型", () => {
    const bad = { ...VALID_LESSON, checks: [{ type: "magic_check" }] };
    expect(LessonSchema.safeParse(bad).success).toBe(false);
  });

  test("拒绝空 hints", () => {
    const bad = { ...VALID_LESSON, hints: [] };
    expect(LessonSchema.safeParse(bad).success).toBe(false);
  });
});

describe("CheckSchema", () => {
  test("接受各类检查", () => {
    const checks = [
      { type: "repo_initialized" },
      { type: "branch_exists", name: "dev" },
      { type: "tag_exists", name: "v1.0", annotated: true },
      { type: "commit_count_at_least", count: 3 },
      { type: "config_value", key: "user.name", value: "学习者", scope: "global" },
      { type: "object_type", object: "HEAD", objectType: "commit" },
    ];
    for (const check of checks) {
      expect(CheckSchema.safeParse(check).success).toBe(true);
    }
  });
});
