/**
 * TUI 引擎端到端测试
 *
 * 验证引擎把「会话沙箱 + 课程加载 + 受限命令执行 + 判题」真正串起来：
 * - 初始化后能进入首个关卡、扁平化全部关卡
 * - 导航（gotoLesson / next）切换当前关卡
 * - runGit 在隔离仓库真实执行命令并刷新状态信号
 * - 自动判题能把用参考解法完成的关卡标记为通关
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  currentLessonId,
  gotoLesson,
  initEngine,
  isCompleted,
  lessonCount,
  runGit,
} from "../../src/tui/engine";
import { gitStatus, sessionMessages } from "../../src/tui/store";

describe("TUI 引擎串联判题流程", () => {
  test("初始化 → 导航 → 真实执行命令 → 自动判题通关", async () => {
    const base = await mkdtemp(join(tmpdir(), "lgi-engine-"));
    try {
      await initEngine({ baseDir: base });

      // 课程已扁平化为多道关卡
      expect(lessonCount()).toBeGreaterThanOrEqual(18);

      // 首个关卡就位，Git 状态信号已被真实查询填充
      const firstId = currentLessonId();
      expect(firstId.length).toBeGreaterThan(0);
      expect(gitStatus().branch.length).toBeGreaterThan(0);

      // 跳转到「合并 PR」关卡（github.pr-merge 在扁平列表中的序号需动态定位）
      // 先线性查找它的序号
      let target = -1;
      for (let i = 1; i <= lessonCount(); i += 1) {
        await gotoLesson(i);
        if (currentLessonId() === "github.pr-merge") {
          target = i;
          break;
        }
      }
      expect(target).toBeGreaterThan(0);
      expect(currentLessonId()).toBe("github.pr-merge");
      expect(isCompleted("github.pr-merge")).toBe(false);

      // 用参考解法的等价命令逐条真实执行，自动判题应把它标记为通关
      await runGit("git fetch origin");
      await runGit('git merge --no-ff origin/feature -m "Merge pull request from alice"');
      await runGit("git push origin main");

      expect(isCompleted("github.pr-merge")).toBe(true);

      // 会话消息里应出现通关提示
      const passed = sessionMessages().some(
        (m) => m.type === "result" && m.content.includes("通关"),
      );
      expect(passed).toBe(true);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }, 120_000);
});
