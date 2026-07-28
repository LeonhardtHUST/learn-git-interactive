/**
 * 配置持久化单元测试：验证 save → load → mark → reset 闭环，以及隔离性。
 * 通过 LEARN_GIT_CONFIG_FILE 环境变量把配置文件重定向到临时目录。
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendCommandHistory,
  completedCount,
  defaultConfig,
  hasIdentity,
  isLessonComplete,
  loadConfig,
  MAX_COMMAND_HISTORY,
  markLessonComplete,
  saveConfig,
  updateConfig,
} from "../../src/progress/store";

const prevConfigFile = process.env.LEARN_GIT_CONFIG_FILE;
let base: string;
let configPath: string;

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "lgi-config-"));
  configPath = join(base, "config.json");
  process.env.LEARN_GIT_CONFIG_FILE = configPath;
});

afterAll(async () => {
  if (prevConfigFile === undefined) delete process.env.LEARN_GIT_CONFIG_FILE;
  else process.env.LEARN_GIT_CONFIG_FILE = prevConfigFile;
  await rm(base, { recursive: true, force: true });
});

describe("配置持久化", () => {
  test("默认配置无用户身份、无已完成关卡", async () => {
    const c = defaultConfig();
    expect(hasIdentity(c)).toBe(false);
    expect(completedCount(c)).toBe(0);
  });

  test("空文件/损坏文件时返回默认配置而非抛错", async () => {
    const c = await loadConfig();
    expect(c.version).toBe(1);
    expect(c.user).toBeDefined();
    expect(completedCount(c)).toBe(0);
  });

  test("save → load 闭环保留用户身份与已完成关卡", async () => {
    let c = defaultConfig();
    c = { ...c, user: { name: "张三", email: "zhangsan@example.com" } };
    c = markLessonComplete(c, "basics.staging");
    c = markLessonComplete(c, "branch.merge");
    expect(hasIdentity(c)).toBe(true);
    expect(completedCount(c)).toBe(2);

    await saveConfig(c);
    const loaded = await loadConfig();
    expect(loaded.user.name).toBe("张三");
    expect(loaded.user.email).toBe("zhangsan@example.com");
    expect(completedCount(loaded)).toBe(2);
    expect(isLessonComplete(loaded, "basics.staging")).toBe(true);
    expect(isLessonComplete(loaded, "branch.merge")).toBe(true);
    expect(isLessonComplete(loaded, "tools.stash")).toBe(false);
  });

  test("重复标记同一关卡不会重复计数", async () => {
    let c = defaultConfig();
    c = markLessonComplete(c, "basics.staging");
    c = markLessonComplete(c, "basics.staging");
    expect(completedCount(c)).toBe(1);
  });

  test("命令历史跨保存恢复，压缩连续重复并保留最近 100 条", async () => {
    let c = defaultConfig();
    c = appendCommandHistory(c, "git status");
    c = appendCommandHistory(c, "git status");
    for (let i = 0; i <= MAX_COMMAND_HISTORY; i += 1) {
      c = appendCommandHistory(c, `git command-${i}`);
    }
    await saveConfig(c);
    const loaded = await loadConfig();
    expect(loaded.commandHistory).toHaveLength(MAX_COMMAND_HISTORY);
    expect(loaded.commandHistory.at(-1)).toBe(`git command-${MAX_COMMAND_HISTORY}`);
    expect(loaded.commandHistory).not.toContain("git status");
  });

  test("旧版配置缺少命令历史时自动迁移为空数组", async () => {
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        user: { name: "旧用户", email: "old@example.com" },
        completedLessons: {},
      }),
      "utf8",
    );
    const loaded = await loadConfig();
    expect(loaded.commandHistory).toEqual([]);
    expect(loaded.user.name).toBe("旧用户");
  });

  test("身份、进度和历史的并发更新不会互相覆盖", async () => {
    await Promise.all([
      updateConfig((config) => ({
        ...config,
        user: { name: "并发用户", email: "parallel@example.com" },
      })),
      updateConfig((config) => markLessonComplete(config, "basics.gitignore")),
      updateConfig((config) => appendCommandHistory(config, "/write .gitignore *.log")),
    ]);
    const loaded = await loadConfig();
    expect(loaded.user.email).toBe("parallel@example.com");
    expect(isLessonComplete(loaded, "basics.gitignore")).toBe(true);
    expect(loaded.commandHistory).toContain("/write .gitignore *.log");
  });
});
