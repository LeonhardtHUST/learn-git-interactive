/**
 * 学习配置持久化
 *
 * 把「用户身份（姓名/邮箱）」与「学习进度」写入家目录下的
 * ~/.learn-git-interactive.json。首次运行会要求填写姓名与邮箱，
 * 之后的课程会引用这些信息（例如配置 Git user.name / user.email）。
 *
 * 注意：沙箱内的实验仓库是临时的（位于 sessions/ 下），不会跨进程持久化；
 * 这里持久化的是「用户身份」与「学习进度」，而非仓库内容。
 *
 * 测试隔离：可通过 LEARN_GIT_CONFIG_FILE 环境变量覆盖配置文件路径，
 * 避免污染真实用户数据。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** 用户身份（首次运行填写，可修改） */
export interface UserProfile {
  name: string;
  email: string;
}

/** 持久化配置结构 */
export interface SavedConfig {
  version: 1;
  /** 用户身份 */
  user: UserProfile;
  /** lessonId -> 完成时间戳（毫秒） */
  completedLessons: Record<string, number>;
  updatedAt: number;
}

/** 配置文件位置：默认 ~/.learn-git-interactive.json */
export function configFile(): string {
  const override = process.env.LEARN_GIT_CONFIG_FILE;
  if (override) return override;
  return join(homedir(), ".learn-git-interactive.json");
}

/** 空配置（尚未填写用户身份） */
export function defaultConfig(): SavedConfig {
  return { version: 1, user: { name: "", email: "" }, completedLessons: {}, updatedAt: Date.now() };
}

/** 判断用户是否已填写身份（姓名与邮箱均非空） */
export function hasIdentity(config: SavedConfig): boolean {
  return config.user.name.trim().length > 0 && config.user.email.trim().length > 0;
}

/** 读取配置；文件不存在或损坏时返回空配置 */
export async function loadConfig(): Promise<SavedConfig> {
  try {
    const text = await readFile(configFile(), "utf8");
    const data = JSON.parse(text) as Partial<SavedConfig>;
    if (data && typeof data === "object" && data.user && data.completedLessons) {
      return {
        version: 1,
        user: {
          name: String(data.user.name ?? ""),
          email: String(data.user.email ?? ""),
        },
        completedLessons: data.completedLessons as Record<string, number>,
        updatedAt: data.updatedAt ?? Date.now(),
      };
    }
  } catch {
    // 文件不存在或 JSON 损坏：视为全新配置
  }
  return defaultConfig();
}

/** 写入配置（自动创建父目录） */
export async function saveConfig(config: SavedConfig): Promise<void> {
  await mkdir(dirname(configFile()), { recursive: true });
  const snapshot: SavedConfig = { ...config, updatedAt: Date.now() };
  await writeFile(configFile(), JSON.stringify(snapshot, null, 2), "utf8");
}

/** 返回把某关卡标记为已完成后的新配置（不可变更新） */
export function markLessonComplete(config: SavedConfig, lessonId: string): SavedConfig {
  return {
    ...config,
    completedLessons: { ...config.completedLessons, [lessonId]: Date.now() },
    updatedAt: Date.now(),
  };
}

/** 某关卡是否已完成 */
export function isLessonComplete(config: SavedConfig, lessonId: string): boolean {
  return Object.hasOwn(config.completedLessons, lessonId);
}

/** 已完成关卡数量 */
export function completedCount(config: SavedConfig): number {
  return Object.keys(config.completedLessons).length;
}
