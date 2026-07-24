/**
 * 学习进度持久化
 *
 * 把已完成关卡、更新时间等写入用户数据目录下的 progress.json。
 * 退出后再次启动可读取该文件恢复进度；/reset 可清空。
 *
 * 注意：沙箱内的实验仓库是临时的（位于 sessions/ 下），不会跨进程持久化；
 * 这里持久化的是「学习进度」而非仓库内容。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appDataDir } from "../sandbox/session";

export interface Progress {
  version: 1;
  /** lessonId -> 完成时间戳（毫秒） */
  completedLessons: Record<string, number>;
  updatedAt: number;
}

/** 进度文件位置（用户数据目录内） */
export function progressFile(): string {
  return join(appDataDir(), "progress.json");
}

export function emptyProgress(): Progress {
  return { version: 1, completedLessons: {}, updatedAt: Date.now() };
}

/** 读取进度；文件不存在或损坏时返回空进度 */
export async function loadProgress(): Promise<Progress> {
  try {
    const text = await readFile(progressFile(), "utf8");
    const data = JSON.parse(text) as Partial<Progress>;
    if (data && typeof data === "object" && data.completedLessons) {
      return {
        version: 1,
        completedLessons: data.completedLessons as Record<string, number>,
        updatedAt: data.updatedAt ?? Date.now(),
      };
    }
  } catch {
    // 文件不存在或 JSON 损坏：视为全新进度
  }
  return emptyProgress();
}

/** 写入进度（自动创建父目录） */
export async function saveProgress(progress: Progress): Promise<void> {
  await mkdir(appDataDir(), { recursive: true });
  const snapshot: Progress = { ...progress, updatedAt: Date.now() };
  await writeFile(progressFile(), JSON.stringify(snapshot, null, 2), "utf8");
}

/** 返回把某关卡标记为已完成后的新进度（不可变更新） */
export function markLessonComplete(progress: Progress, lessonId: string): Progress {
  return {
    ...progress,
    completedLessons: { ...progress.completedLessons, [lessonId]: Date.now() },
    updatedAt: Date.now(),
  };
}

/** 某关卡是否已完成 */
export function isLessonComplete(progress: Progress, lessonId: string): boolean {
  return Object.hasOwn(progress.completedLessons, lessonId);
}

/** 已完成关卡数量 */
export function completedCount(progress: Progress): number {
  return Object.keys(progress.completedLessons).length;
}
