import { describe, expect, test } from "bun:test";
import { listLessonFiles, loadCourse, loadLesson } from "../src/course/loader";

describe("内置课程目录", () => {
  test("静态导入目录与磁盘上的全部关卡保持一致", async () => {
    const [course, files] = await Promise.all([loadCourse("zh-CN"), listLessonFiles("zh-CN")]);
    const diskIds = new Set((await Promise.all(files.map(loadLesson))).map((lesson) => lesson.id));

    expect(course.lessons.size).toBe(34);
    expect(new Set(course.lessons.keys())).toEqual(diskIds);
    expect(course.chapters.flatMap((chapter) => chapter.lessons).length).toBe(34);
  });
});
