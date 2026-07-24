/**
 * 课程与关卡数据模型（Zod schema）
 *
 * 每个关卡独立保存为 YAML；判定器检查实际仓库状态，
 * 同一目标允许多种正确命令序列。
 */

import { z } from "zod";

/** 判题检查类型 */
export const CheckSchema = z.discriminatedUnion("type", [
  // ── 工作区 / 暂存区 ──
  z.object({ type: z.literal("index_contains"), path: z.string() }),
  z.object({ type: z.literal("index_not_contains"), path: z.string() }),
  z.object({ type: z.literal("worktree_modified"), path: z.string() }),
  z.object({ type: z.literal("worktree_clean") }),
  z.object({ type: z.literal("index_clean") }),
  z.object({ type: z.literal("file_exists"), path: z.string() }),
  z.object({ type: z.literal("file_absent"), path: z.string() }),
  z.object({ type: z.literal("file_content"), path: z.string(), contains: z.string() }),
  z.object({ type: z.literal("file_ignored"), path: z.string() }),
  z.object({ type: z.literal("untracked_present"), path: z.string() }),

  // ── 提交与历史 ──
  z.object({ type: z.literal("head_commit_message"), contains: z.string() }),
  z.object({ type: z.literal("commit_count_at_least"), count: z.number().int().positive() }),
  z.object({
    type: z.literal("commit_message_exists"),
    contains: z.string(),
    ref: z.string().optional(),
  }),
  z.object({ type: z.literal("head_is_ancestor_of"), ref: z.string() }),
  z.object({ type: z.literal("ref_is_ancestor_of_head"), ref: z.string() }),
  z.object({ type: z.literal("repo_initialized") }),
  z.object({ type: z.literal("is_linear_history"), ref: z.string().optional() }),
  z.object({ type: z.literal("head_has_parents"), count: z.number().int().positive() }),

  // ── 分支 / 标签 / 引用 ──
  z.object({ type: z.literal("branch_exists"), name: z.string() }),
  z.object({ type: z.literal("branch_absent"), name: z.string() }),
  z.object({ type: z.literal("current_branch"), name: z.string() }),
  z.object({ type: z.literal("tag_exists"), name: z.string(), annotated: z.boolean().optional() }),
  z.object({ type: z.literal("refs_equal"), a: z.string(), b: z.string() }),
  z.object({ type: z.literal("head_detached") }),

  // ── 远程 ──
  z.object({ type: z.literal("remote_exists"), name: z.string() }),
  z.object({ type: z.literal("upstream_set"), branch: z.string(), upstream: z.string() }),
  z.object({
    type: z.literal("remote_branch_contains"),
    remoteRef: z.string(),
    localRef: z.string(),
  }),

  // ── 冲突 / stash / reflog ──
  z.object({ type: z.literal("conflict_present") }),
  z.object({ type: z.literal("no_conflict") }),
  z.object({ type: z.literal("stash_count_at_least"), count: z.number().int().nonnegative() }),
  z.object({ type: z.literal("reflog_contains"), pattern: z.string() }),

  // ── 配置（沙箱内） ──
  z.object({
    type: z.literal("config_value"),
    key: z.string(),
    value: z.string(),
    scope: z.enum(["global", "local"]).optional(),
  }),
  z.object({ type: z.literal("alias_defined"), name: z.string() }),

  // ── 对象与内部原理 ──
  z.object({
    type: z.literal("object_type"),
    object: z.string(),
    objectType: z.enum(["blob", "tree", "commit", "tag"]),
  }),
]);

export type Check = z.infer<typeof CheckSchema>;

/** fixture 文件定义 */
export const FixtureFileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

/** fixture 构建步骤（在沙箱 learner 仓库中按序执行） */
export const FixtureStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("init") }),
  z.object({ action: z.literal("write"), path: z.string(), content: z.string() }),
  z.object({ action: z.literal("append"), path: z.string(), content: z.string() }),
  z.object({ action: z.literal("remove"), path: z.string() }),
  z.object({ action: z.literal("git"), args: z.array(z.string()) }),
  /** 创建本地 bare remote 并关联为 origin */
  z.object({ action: z.literal("bare_remote"), name: z.string().default("origin") }),
  /** 在另一个 clone（如 alice）中执行 git 命令，模拟协作者 */
  z.object({ action: z.literal("clone_as"), name: z.string() }),
  z.object({ action: z.literal("git_in"), repo: z.string(), args: z.array(z.string()) }),
  z.object({
    action: z.literal("write_in"),
    repo: z.string(),
    path: z.string(),
    content: z.string(),
  }),
]);

export type FixtureStep = z.infer<typeof FixtureStepSchema>;

/** 关卡 schema */
export const LessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "关卡 id 形如 basics.staging"),
  title: z.string(),
  source: z.object({
    chapter: z.string(),
    url: z.string().optional(),
  }),
  prerequisites: z.array(z.string()).default([]),
  /** 简短讲解（原创内容，允许多段） */
  intro: z.string(),
  /** 任务描述 */
  task: z.string(),
  setup: z.object({
    fixture: z.array(FixtureStepSchema).default([{ action: "init" }]),
  }),
  objectives: z.array(z.string()).min(1),
  capabilities: z.object({
    commands: z.array(z.string()).min(1),
    deniedFlags: z.record(z.string(), z.array(z.string())).optional(),
  }),
  checks: z.array(CheckSchema).min(1),
  hints: z.array(z.string()).min(1),
  /** 通关后的解释说明 */
  explanation: z.string().optional(),
});

export type Lesson = z.infer<typeof LessonSchema>;

/** 章节 schema（章节清单文件 chapter.yaml） */
export const ChapterSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  lessons: z.array(z.string()),
});

export type Chapter = z.infer<typeof ChapterSchema>;

/** 课程路线 schema（course.yaml） */
export const CourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  chapters: z.array(z.string()),
});

export type Course = z.infer<typeof CourseSchema>;
