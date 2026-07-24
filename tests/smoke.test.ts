import { describe, expect, test } from "bun:test";

describe("项目骨架", () => {
  test("入口模块可导入", () => {
    // 验证模块存在且不抛异常
    expect(() => import("../src/main.ts")).not.toThrow();
  });

  test("OpenTUI core 可导入", async () => {
    const ot = await import("@opentui/core");
    expect(ot.createCliRenderer).toBeDefined();
    expect(ot.Text).toBeDefined();
    expect(ot.Box).toBeDefined();
  });

  test("OpenTUI solid 可导入", async () => {
    const ots = await import("@opentui/solid");
    expect(ots).toBeDefined();
  });
});
