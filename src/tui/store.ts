/**
 * TUI 框架全局状态
 *
 * 管理 UI 状态，与课程/判题/沙箱解耦。
 */

import { createSignal } from "solid-js";
import type { UserProfile } from "../progress/store";

/** 当前视图模式 */
export type ViewMode = "course" | "lessons" | "command" | "themes" | "help";

/** 一条会话消息 */
export interface SessionMessage {
  id: number;
  type: "system" | "user" | "git-output" | "result" | "hint";
  content: string;
  timestamp: number;
}

/** 真实 Git 仓库状态快照（由引擎查询实验仓库后写入） */
export interface GitStatus {
  branch: string;
  head: string;
  workingTree: string;
  index: string;
  remoteTracking: string;
}

// --- 全局状态 ---

export const [viewMode, setViewMode] = createSignal<ViewMode>("course");

/** 顶层屏幕：登录界面 / 主课程界面（由 Root 组件依据此信号切换） */
export type Screen = "login" | "course";
export const [screen, setScreen] = createSignal<Screen>("login");

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
  course: "Git 交互式课程",
  chapter: "加载中…",
  lesson: "",
  completed: 0,
  total: 0,
});

export const [gitStatus, setGitStatus] = createSignal<GitStatus>({
  branch: "—",
  head: "—",
  workingTree: "clean",
  index: "clean",
  remoteTracking: "（无上游）",
});

/** 提交关系图文本行（由引擎 git log --graph 生成） */
export const [commitGraph, setCommitGraph] = createSignal<string[]>(["（暂无提交）"]);

/** 自动判题开关（默认开） */
export const [autograde, setAutograde] = createSignal(true);

export const [showGitStatus, setShowGitStatus] = createSignal(true);

export const [showCommitGraph, setShowCommitGraph] = createSignal(false);

export const [currentCommand, setCurrentCommand] = createSignal("");

/** 当前登录用户（首次运行填写，可修改） */
export const [user, setUser] = createSignal<UserProfile>({ name: "", email: "" });

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
