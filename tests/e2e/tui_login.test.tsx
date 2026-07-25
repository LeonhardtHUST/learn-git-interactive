/**
 * 登录流程端到端测试
 *
 * 覆盖首屏路由的两个分支，并把「登录 UI」与「进入课程」两个关注点拆开，
 * 避免依赖跨渲染器的异步重渲染竞态：
 *
 * 1. 登录 UI（新用户）：渲染登录卡片 → 填写姓名/邮箱 → 回车切换/提交，
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

describe("登录流程", () => {
  test("登录 UI：填写姓名/邮箱并回车 → onComplete 收到正确身份", async () => {
    let captured: UserProfile | undefined;
    const setup = await (await import("@opentui/solid")).testRender(() => (
      <LoginScreen
        onComplete={(u) => {
          captured = u;
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

    // 等待 onComplete 被回调（提交是同步的，这里给渲染器几帧处理输入事件）
    for (let i = 0; i < 100 && captured === undefined; i++) {
      await new Promise((r) => setTimeout(r, 50));
      await setup.renderOnce();
    }

    expect(captured).toBeDefined();
    expect(captured?.name).toBe("李四");
    expect(captured?.email).toBe("lisi@example.com");
  }, 30_000);

  test("进入课程：prepareCourse 落盘身份 → 首个配置关卡引用用户姓名", async () => {
    const base = await mkdtemp(join(tmpdir(), "lgi-enter-"));
    try {
      await withEnv(base, async () => {
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
        const saved = JSON.parse(await readFile(process.env.LEARN_GIT_CONFIG_FILE!, "utf8")) as {
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
        const cfg = {
          version: 1 as const,
          user: { name: "王五", email: "wangwu@example.com" },
          completedLessons: {} as Record<string, number>,
          updatedAt: Date.now(),
        };
        // 预置一份已有身份的配置
        await Bun.write(process.env.LEARN_GIT_CONFIG_FILE!, JSON.stringify(cfg));
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
