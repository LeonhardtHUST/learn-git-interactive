/**
 * TUI 框架全局状态
 *
 * 管理 UI 状态，与课程/判题/沙箱解耦。
 */

import { createSignal } from "solid-js";

/** 当前视图模式 */
export type ViewMode = "course" | "lessons" | "command" | "themes" | "help";

/** 一条会话消息 */
export interface SessionMessage {
  id: number;
  type: "system" | "user" | "git-output" | "result" | "hint";
  content: string;
  timestamp: number;
}

/** 模拟 Git 状态（Phase 3 占位，Phase 4 替换） */
export interface GitStatus {
  branch: string;
  head: string;
  workingTree: string;
  index: string;
  remoteTracking: string;
}

// --- 全局状态 ---

export const [viewMode, setViewMode] = createSignal<ViewMode>("course");

export const [inputValue, setInputValue] = createSignal("");

export const [sessionMessages, setSessionMessages] = createSignal<SessionMessage[]>([
  {
    id: 0,
    type: "system",
    content:
      "欢迎来到 Git 交互式课程！\n\n本课程以《Pro Git》第二版为知识主线，在真实的隔离 Git 环境中完成任务。\n\n输入 /help 查看可用命令，或输入 /lessons 浏览课程。",
    timestamp: Date.now(),
  },
]);

export const [progress, setProgress] = createSignal({
  course: "Git 基础",
  chapter: "第 1 章：起步",
  lesson: "1.1 关于版本控制",
  completed: 0,
  total: 18,
});

export const [gitStatus, setGitStatus] = createSignal<GitStatus>({
  branch: "main",
  head: "9413c0c",
  workingTree: "clean",
  index: "clean",
  remoteTracking: "origin/main ↑0 ↓0",
});

export const [showGitStatus, setShowGitStatus] = createSignal(true);

export const [showCommitGraph, setShowCommitGraph] = createSignal(false);

export const [currentCommand, setCurrentCommand] = createSignal("");

let nextMessageId = 1;

export function addMessage(type: SessionMessage["type"], content: string) {
  setSessionMessages((prev) => [
    ...prev,
    { id: nextMessageId++, type, content, timestamp: Date.now() },
  ]);
}

export function clearMessages() {
  setSessionMessages([]);
}
