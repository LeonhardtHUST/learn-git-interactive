/**
 * 课程内容加载器
 *
 * 从 courses/<locale>/ 加载课程、章节与关卡 YAML，并用 Zod 校验。
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import {
  type Chapter,
  ChapterSchema,
  type Course,
  CourseSchema,
  type Lesson,
  LessonSchema,
} from "./schema";

export interface LoadedCourse {
  course: Course;
  chapters: Chapter[];
  lessons: Map<string, Lesson>;
}

/** 课程根目录（相对项目根） */
export function coursesDir(locale = "zh-CN"): string {
  return join(import.meta.dir, "..", "..", "courses", locale);
}

async function readYaml(path: string): Promise<unknown> {
  const text = await Bun.file(path).text();
  return parse(text);
}

/** 加载单个关卡文件 */
export async function loadLesson(path: string): Promise<Lesson> {
  const raw = await readYaml(path);
  const result = LessonSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`关卡文件 ${path} 校验失败：\n${result.error.message}`);
  }
  return result.data;
}

/** 加载整个课程目录 */
export async function loadCourse(locale = "zh-CN"): Promise<LoadedCourse> {
  const root = coursesDir(locale);

  const courseRaw = await readYaml(join(root, "course.yaml"));
  const course = CourseSchema.parse(courseRaw);

  const chapters: Chapter[] = [];
  const lessons = new Map<string, Lesson>();

  for (const chapterId of course.chapters) {
    const chapterDir = join(root, chapterId);
    const chapterRaw = await readYaml(join(chapterDir, "chapter.yaml"));
    const chapter = ChapterSchema.parse(chapterRaw);
    chapters.push(chapter);

    for (const lessonFile of chapter.lessons) {
      const lesson = await loadLesson(join(chapterDir, lessonFile));
      if (lessons.has(lesson.id)) {
        throw new Error(`关卡 id 重复：${lesson.id}`);
      }
      lessons.set(lesson.id, lesson);
    }
  }

  return { course, chapters, lessons };
}

/** 列出全部关卡文件路径（供契约测试遍历） */
export async function listLessonFiles(locale = "zh-CN"): Promise<string[]> {
  const root = coursesDir(locale);
  const files: string[] = [];
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".yaml") &&
      entry.name !== "chapter.yaml" &&
      entry.name !== "course.yaml"
    ) {
      files.push(join(entry.parentPath ?? (entry as unknown as { path: string }).path, entry.name));
    }
  }
  return files.sort();
}
