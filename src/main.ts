/**
 * learn-git-interactive — 中文交互式 Git 课程
 *
 * 以《Pro Git》第二版简体中文版为知识主线，在隔离的真实 Git 仓库中完成任务。
 * 终端交互借鉴 OpenCode TUI：全屏会话流、底部多行输入、/ 命令面板、键盘优先。
 *
 * @license MIT (程序代码) / CC BY-NC-SA 3.0 (课程内容)
 */

import { startTui } from "./tui/app";
import { loadCourse } from "./course/loader";
import { gitVersion } from "./git/executable";

/** 编译产物与安装环境的非交互自检入口。 */
export async function selfTest(): Promise<void> {
  const course = await loadCourse();
  const version = await gitVersion();
  console.log(`learn-git-interactive ok: ${course.lessons.size} lessons; ${version}`);
}

export async function main(): Promise<void> {
  if (Bun.argv.includes("--self-test")) {
    await selfTest();
    return;
  }
  await startTui();
}

if (import.meta.main) {
  main();
}
