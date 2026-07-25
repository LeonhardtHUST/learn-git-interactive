/**
 * 关卡用户变量替换单元测试：
 * 验证 {{user.name}}/{{user.email}} 在文本、判题检查、参考解法命令中被正确替换。
 */

import { describe, expect, test } from "bun:test";
import type { Lesson } from "../../src/course/schema";
import { substituteLesson, substituteText } from "../../src/course/substitute";

const user = { name: "张三", email: "zhangsan@example.com" };

describe("关卡用户变量替换", () => {
  test("单字符串替换姓名与邮箱", () => {
    expect(substituteText("你好 {{user.name}}", user)).toBe("你好 张三");
    expect(substituteText("邮箱 {{ user.email }}", user)).toBe("邮箱 zhangsan@example.com");
    expect(substituteText("无占位符", user)).toBe("无占位符");
  });

  test("替换后的关卡可在判题与解法中保持一致", () => {
    const lesson = {
      id: "config.user",
      title: "配置 {{user.name}} 的身份",
      intro: "你好 {{user.name}}",
      task: "设置 {{user.name}} / {{user.email}}",
      checks: [{ type: "config_value", key: "user.name", value: "{{user.name}}" }],
      solution: [{ action: "git", args: ["config", "--global", "user.name", "{{user.name}}"] }],
    } as unknown as Lesson;

    const resolved = substituteLesson(lesson, user);
    expect(resolved.title).toBe("配置 张三 的身份");
    expect(resolved.intro).toBe("你好 张三");
    const check = resolved.checks[0] as { value: string };
    expect(check.value).toBe("张三");
    const solution = resolved.solution as { args: string[] }[];
    expect(solution[0]?.args[3]).toBe("张三");
  });

  test("未提供用户时占位符变为空字符串（不影响其它关卡）", () => {
    const lesson = { id: "x.y", task: "做点事 {{user.name}}" } as unknown as Lesson;
    const resolved = substituteLesson(lesson, { name: "", email: "" });
    expect(resolved.task).toBe("做点事 ");
  });
});
