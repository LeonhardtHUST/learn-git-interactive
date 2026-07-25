/**
 * 登录流程端到端测试
 *
 * 覆盖首屏路由的两个分支，并把「登录 UI」与「进入课程」两个关注点拆开，
 * 避免依赖跨渲染器的异步重渲染竞态：
 *
 * 1. 登录 UI（新用户）：渲染登录卡片 → 填写姓名/邮箱 → 回车/Tab/空格/鼠标切换焦点并提交，
 *    断言 onComplete 收到正确的 {name,email}。
 * 2. 进入课程（新用户）：prepareCourse 落盘身份并初始化引擎后渲染 <App />，
 *    断言首个配置关卡引用用户姓名/邮箱（而非占位符「练习者」），且配置已落盘。
 * 3. 返回用户：已有配置时直接渲染 <App />，跳过登录卡片。
 *
 * 通过 LEARN_GIT_CONFIG_FILE / LEARN_GIT_SESSION_DIR 把配置与会话目录
 * 重定向到临时目录，避免污染真实用户数据。
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CapturedFrame } from "@opentui/core";
import App, { prepareCourse } from "../../src/tui/app";
import { LoginScreen } from "../../src/tui/login";
import { initEngine } from "../../src/tui/engine";
import type { UserProfile } from "../../src/progress/store";

async function withEnv(base: string, fn: () => Promise<void>) {
  const configPath = join(base, ".learn-git-interactive.json");
  const prevConfig = process.env.LEARN_GIT_CONFIG_FILE;
  const prevSession = process.env.LEARN_GIT_SESSION_DIR;
  process.env.LEARN_GIT_CONFIG_FILE = configPath;
  process.env.LEARN_GIT_SESSION_DIR = join(base, "sessions");
  try {
    await fn();
  } finally {
    if (prevConfig === undefined) delete process.env.LEARN_GIT_CONFIG_FILE;
    else process.env.LEARN_GIT_CONFIG_FILE = prevConfig;
    if (prevSession === undefined) delete process.env.LEARN_GIT_SESSION_DIR;
    else process.env.LEARN_GIT_SESSION_DIR = prevSession;
  }
}

/** 在渲染帧中定位包含指定文本的 span 的点击位置 */
function findSpanCenter(frame: CapturedFrame, text: string): { x: number; y: number } | null {
  for (let y = 0; y < frame.lines.length; y++) {
    const line = frame.lines[y];
    if (!line) continue;
    let x = 0;
    for (const span of line.spans) {
      if (span.text.includes(text)) {
        return { x: x + Math.floor(span.width / 2), y };
      }
      x += span.width;
    }
  }
  return null;
}

async function waitForCaptured(
  setup: { renderOnce: () => Promise<void> },
  captured: { current?: UserProfile },
  timeoutMs = 5000,
): Promise<UserProfile> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await setup.renderOnce();
    if (captured.current) return captured.current;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timeout waiting for onComplete callback");
}

describe("登录流程", () => {
  test("登录 UI：填写姓名/邮箱并回车 → onComplete 收到正确身份", async () => {
    const captured: { current?: UserProfile } = {};
    const setup = await (await import("@opentui/solid")).testRender(() => (
      <LoginScreen
        onComplete={(u) => {
          captured.current = u;
        }}
      />
    ));
    await setup.waitFor(() => setup.captureCharFrame().includes("首次使用"), {
      maxPasses: 200,
    });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("姓名");
    expect(frame).toContain("邮箱");

    // 填写姓名，回车切到邮箱，填写邮箱并回车提交。
    // 每一步之间 renderOnce()，确保输入/焦点切换被渲染器处理。
    await setup.mockInput.typeText("李四");
    await setup.renderOnce();
    await setup.mockInput.pressEnter(); // 姓名回车 → 焦点切到邮箱框
    await setup.renderOnce();
    await setup.waitForVisualIdle();
    await setup.mockInput.typeText("lisi@example.com");
    await setup.renderOnce();
    await setup.mockInput.pressEnter(); // 邮箱回车 → 校验通过 → 提交
    await setup.renderOnce();

    const user = await waitForCaptured(setup, captured);
    expect(user.name).toBe("李四");
    expect(user.email).toBe("lisi@example.com");
  }, 30_000);

  test("登录 UI：Tab 循环到确认按钮 → 空格提交", async () => {
    const captured: { current?: UserProfile } = {};
    const setup = await (await import("@opentui/solid")).testRender(() => (
      <LoginScreen
        onComplete={(u) => {
          captured.current = u;
        }}
      />
    ));
    await setup.waitFor(() => setup.captureCharFrame().includes("确认提交"), {
      maxPasses: 200,
    });

    await setup.mockInput.typeText("李四");
    await setup.renderOnce();
    await setup.mockInput.pressTab();
    await setup.renderOnce();
    await setup.mockInput.typeText("lisi@example.com");
    await setup.renderOnce();
    await setup.mockInput.pressTab();
    await setup.renderOnce();
    await setup.mockInput.pressKey(" "); // 按钮聚焦时按空格 → 提交
    await setup.renderOnce();

    const user = await waitForCaptured(setup, captured);
    expect(user.name).toBe("李四");
    expect(user.email).toBe("lisi@example.com");
  }, 30_000);

  test("登录 UI：Shift+Tab 反向切到确认按钮 → 空格提交", async () => {
    const captured: { current?: UserProfile } = {};
    const setup = await (await import("@opentui/solid")).testRender(() => (
      <LoginScreen
        initial={{ name: "李四", email: "lisi@example.com" }}
        onComplete={(u) => {
          captured.current = u;
        }}
      />
    ));
    await setup.waitFor(() => setup.captureCharFrame().includes("确认提交"), {
      maxPasses: 200,
    });

    // 焦点默认在姓名框；Shift+Tab 反向循环到确认按钮
    await setup.mockInput.pressTab({ shift: true });
    await setup.renderOnce();
    await setup.mockInput.pressKey(" "); // 空格提交
    await setup.renderOnce();

    const user = await waitForCaptured(setup, captured);
    expect(user.name).toBe("李四");
    expect(user.email).toBe("lisi@example.com");
  }, 30_000);

  test("登录 UI：鼠标点击确认按钮 → 提交", async () => {
    const captured: { current?: UserProfile } = {};
    const setup = await (await import("@opentui/solid")).testRender(() => (
      <LoginScreen
        onComplete={(u) => {
          captured.current = u;
        }}
      />
    ));
    await setup.waitFor(() => setup.captureCharFrame().includes("确认提交"), {
      maxPasses: 200,
    });

    await setup.mockInput.typeText("李四");
    await setup.renderOnce();
    await setup.mockInput.pressTab();
    await setup.renderOnce();
    await setup.mockInput.typeText("lisi@example.com");
    await setup.renderOnce();
    await setup.waitForVisualIdle();

    const pos = findSpanCenter(setup.captureSpans(), "确认提交");
    expect(pos).not.toBeNull();
    if (!pos) throw new Error("未找到确认提交按钮位置");
    await setup.mockMouse.click(pos.x, pos.y);
    await setup.renderOnce();

    const user = await waitForCaptured(setup, captured);
    expect(user.name).toBe("李四");
    expect(user.email).toBe("lisi@example.com");
  }, 30_000);

  test("进入课程：prepareCourse 落盘身份 → 首个配置关卡引用用户姓名", async () => {
    const base = await mkdtemp(join(tmpdir(), "lgi-enter-"));
    try {
      await withEnv(base, async () => {
        const configFile = process.env.LEARN_GIT_CONFIG_FILE;
        if (!configFile) throw new Error("LEARN_GIT_CONFIG_FILE not set");

        // 落盘身份 + 初始化引擎（不渲染），随后自行渲染主界面
        await prepareCourse({ name: "李四", email: "lisi@example.com" });

        const setup = await (await import("@opentui/solid")).testRender(() => <App />);
        await setup.waitFor(() => setup.captureCharFrame().includes("进度 0/34"), {
          maxPasses: 400,
        });
        const frame = setup.captureCharFrame();

        expect(frame).toContain("进度");
        // 首个配置关卡应使用用户自己的姓名/邮箱，而非占位符「练习者」
        expect(frame).toContain("李四");
        expect(frame).toContain("lisi@example.com");
        expect(frame).not.toContain("练习者");

        // 配置已落盘且包含用户身份
        const saved = JSON.parse(await readFile(configFile, "utf8")) as {
          user: { name: string; email: string };
        };
        expect(saved.user.name).toBe("李四");
        expect(saved.user.email).toBe("lisi@example.com");
      });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }, 60_000);

  test("返回用户：已有配置时直接跳过登录进入课程", async () => {
    const base = await mkdtemp(join(tmpdir(), "lgi-login-return-"));
    try {
      await withEnv(base, async () => {
        const configFile = process.env.LEARN_GIT_CONFIG_FILE;
        if (!configFile) throw new Error("LEARN_GIT_CONFIG_FILE not set");

        const cfg = {
          version: 1 as const,
          user: { name: "王五", email: "wangwu@example.com" },
          completedLessons: {} as Record<string, number>,
          updatedAt: Date.now(),
        };
        // 预置一份已有身份的配置
        await Bun.write(configFile, JSON.stringify(cfg));
        // 预先初始化引擎，再直接进入课程
        await initEngine({ user: cfg.user, completed: cfg.completedLessons });

        const setup = await (await import("@opentui/solid")).testRender(() => <App />);
        await setup.waitFor(() => setup.captureCharFrame().includes("进度"), {
          maxPasses: 400,
        });

        const frame = setup.captureCharFrame();
        // 不应出现登录卡片
        expect(frame).not.toContain("首次使用");
        // 应直接显示课程主界面
        expect(frame).toContain("进度");
      });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }, 60_000);
});
