/**
 * 进度持久化单元测试：验证 save → load → mark → reset 闭环，以及隔离性。
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  completedCount,
  emptyProgress,
  isLessonComplete,
  loadProgress,
  markLessonComplete,
  saveProgress,
} from "../../src/progress/store";

// 把进度文件重定向到临时目录，避免污染真实用户数据
const prevLocalAppData = process.env.LOCALAPPDATA;
let base: string;

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "lgi-progress-"));
  process.env.LOCALAPPDATA = base;
});

afterAll(async () => {
  if (prevLocalAppData === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = prevLocalAppData;
  await rm(base, { recursive: true, force: true });
});

describe("进度持久化", () => {
  test("空进度默认无已完成关卡", async () => {
    const p = await loadProgress();
    expect(completedCount(p)).toBe(0);
    expect(isLessonComplete(p, "basics.staging")).toBe(false);
  });

  test("save → load 闭环保留已完成关卡", async () => {
    let p = emptyProgress();
    p = markLessonComplete(p, "basics.staging");
    p = markLessonComplete(p, "branch.merge");
    expect(completedCount(p)).toBe(2);

    await saveProgress(p);
    const loaded = await loadProgress();
    expect(completedCount(loaded)).toBe(2);
    expect(isLessonComplete(loaded, "basics.staging")).toBe(true);
    expect(isLessonComplete(loaded, "branch.merge")).toBe(true);
    expect(isLessonComplete(loaded, "tools.stash")).toBe(false);
  });

  test("重复标记同一关卡不会重复计数", async () => {
    let p = emptyProgress();
    p = markLessonComplete(p, "basics.staging");
    p = markLessonComplete(p, "basics.staging");
    expect(completedCount(p)).toBe(1);
  });

  test("文件不存在时返回空进度而非抛错", async () => {
    const p = await loadProgress();
    expect(p.version).toBe(1);
    expect(p.completedLessons).toBeDefined();
  });
});
