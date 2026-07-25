/**
 * 关卡用户变量替换
 *
 * 课程文本、判题检查、参考解法中可以嵌入 {{user.name}} / {{user.email}} 占位符，
 * 在引擎加载关卡时按当前登录用户替换为真实值。这样「配置 Git 身份」等关卡
 * 会自动引用学习者自己填写的姓名与邮箱，而不必写死。
 *
 * 采用「整棵对象深拷贝 + 字符串替换」实现，覆盖所有字符串字段
 * （intro / task / objectives / hints / explanation / checks.value / solution 命令参数等），
 * 无需为每个字段单独处理。
 */

import type { Lesson } from "./schema";
import type { UserProfile } from "../progress/store";

const TOKEN_RE = /\{\{\s*user\.(name|email)\s*\}\}/g;

const TOKEN_VALUES: Record<string, (u: UserProfile) => string> = {
  name: (u) => u.name,
  email: (u) => u.email,
};

/** 替换单个字符串中的用户占位符 */
export function substituteText(text: string, user: UserProfile): string {
  if (!text) return text;
  return text.replace(TOKEN_RE, (_match, key: string) => {
    const getter = TOKEN_VALUES[key];
    return getter ? getter(user) : _match;
  });
}

/**
 * 返回替换了用户变量后的关卡副本。
 * 对整个关卡对象做深拷贝（JSON 往返），对其中每个字符串字段做占位符替换。
 */
export function substituteLesson(lesson: Lesson, user: UserProfile): Lesson {
  const cloned = JSON.parse(JSON.stringify(lesson)) as Lesson;
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return substituteText(node, user);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  };
  return walk(cloned) as Lesson;
}
