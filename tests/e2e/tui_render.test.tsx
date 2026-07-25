/**
 * TUI 渲染回归测试
 *
 * 验证 App 在 test renderer 中能成功首屏渲染，捕获 JSX/组件兼容问题
 *（如 OpenTUI Solid 的 <Show> 在特定真假组合下会产生 orphan text）。
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import App from "../../src/tui/app";
import { initEngine } from "../../src/tui/engine";

describe("TUI 渲染", () => {
  test("App 能成功渲染首屏", async () => {
    const base = await mkdtemp(join(tmpdir(), "lgi-tui-render-"));
    try {
      await initEngine({ baseDir: base });
      const setup = await (await import("@opentui/solid")).testRender(() => App());
      await setup.waitForVisualIdle();
      expect(setup.captureCharFrame().length).toBeGreaterThan(0);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }, 60_000);
});
