/**
 * 首次运行登录界面
 *
 * 以「登录卡片」形式居中展示，要求填写姓名与邮箱。
 * 支持键盘 Tab / Shift+Tab 在「姓名、邮箱、确认按钮」之间循环切换焦点，
 * 回车提交；同时支持鼠标点击输入框/按钮聚焦与提交。
 * 校验通过后由 props.onComplete 通知父级完成登录。
 */

import {
  TextAttributes,
  type BoxRenderable,
  type InputRenderable,
  type KeyEvent,
} from "@opentui/core";
import { createSignal, type Component } from "solid-js";
import type { UserProfile } from "../progress/store";
import { OpenCodeTheme } from "./theme";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FOCUS_NAME = 0;
const FOCUS_EMAIL = 1;
const FOCUS_BUTTON = 2;

export interface LoginScreenProps {
  /** 提交成功（姓名与邮箱均校验通过）时回调 */
  onComplete: (user: UserProfile) => void;
  /** 初始值（用于「可修改」场景：返回用户重新进入时预填） */
  initial?: UserProfile;
}

export const LoginScreen: Component<LoginScreenProps> = (props) => {
  const [name, setName] = createSignal(props.initial?.name ?? "");
  const [email, setEmail] = createSignal(props.initial?.email ?? "");
  const [error, setError] = createSignal("");
  const [focusIndex, setFocusIndex] = createSignal(FOCUS_NAME);

  let nameRef: InputRenderable | undefined;
  let emailRef: InputRenderable | undefined;
  let buttonRef: BoxRenderable | undefined;

  const focusField = (idx: number) => {
    setFocusIndex(idx);
    // 显式 blur 其它字段：focused 属性在部分渲染器下不具备响应式，
    // 若不 blur 会出现多个输入框同时聚焦、打字被同时写入两个框的 bug。
    if (idx !== FOCUS_NAME) nameRef?.blur();
    if (idx !== FOCUS_EMAIL) emailRef?.blur();
    if (idx !== FOCUS_BUTTON) buttonRef?.blur();
    if (idx === FOCUS_NAME) nameRef?.focus();
    else if (idx === FOCUS_EMAIL) emailRef?.focus();
    else if (idx === FOCUS_BUTTON) buttonRef?.focus();
  };

  const submit = () => {
    const n = name().trim();
    const e = email().trim();
    if (!n) {
      setError("请填写你的姓名。");
      focusField(FOCUS_NAME);
      return;
    }
    if (!EMAIL_RE.test(e)) {
      setError("请填写有效的邮箱（如 name@example.com）。");
      focusField(FOCUS_EMAIL);
      return;
    }
    setError("");
    props.onComplete({ name: n, email: e });
  };

  // 姓名框回车：邮箱已填则提交，否则切到邮箱框
  const onNameSubmit = () => {
    if (email().trim()) submit();
    else focusField(FOCUS_EMAIL);
  };

  const onKeyNavigation = (e: KeyEvent, current: number) => {
    if (e.name === "tab") {
      e.preventDefault();
      e.stopPropagation();
      const next = e.shift ? (current - 1 + 3) % 3 : (current + 1) % 3;
      focusField(next);
      return;
    }
    if (
      current === FOCUS_BUTTON &&
      (e.name === "return" || e.name === "enter" || e.name === "space")
    ) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  };

  const buttonFocused = () => focusIndex() === FOCUS_BUTTON;

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={OpenCodeTheme.background}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <box
        borderStyle="single"
        borderColor={OpenCodeTheme.border}
        padding={2}
        width={60}
        flexDirection="column"
        backgroundColor={OpenCodeTheme.backgroundPanel}
      >
        <text fg={OpenCodeTheme.primary} attributes={TextAttributes.BOLD}>
          🎓 Git 交互式课程
        </text>
        <text fg={OpenCodeTheme.text}>首次使用，请设置你的 Git 身份：</text>
        <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
          姓名与邮箱会用于课程里的配置任务（如 git config user.name）。
        </text>

        <text fg={OpenCodeTheme.secondary}>姓名</text>
        <box flexDirection="row" onMouseDown={() => focusField(FOCUS_NAME)}>
          <input
            ref={(el) => (nameRef = el as InputRenderable)}
            placeholder="如：张三"
            value={props.initial?.name ?? ""}
            focused
            backgroundColor={OpenCodeTheme.selection}
            textColor={OpenCodeTheme.text}
            focusedBackgroundColor={OpenCodeTheme.selection}
            focusedTextColor={OpenCodeTheme.text}
            placeholderColor={OpenCodeTheme.textMuted}
            onInput={(v: string) => setName(v)}
            onSubmit={onNameSubmit}
            onKeyDown={(e: KeyEvent) => onKeyNavigation(e, FOCUS_NAME)}
          />
        </box>

        <text fg={OpenCodeTheme.secondary}>邮箱</text>
        <box flexDirection="row" onMouseDown={() => focusField(FOCUS_EMAIL)}>
          <input
            ref={(el) => (emailRef = el as InputRenderable)}
            placeholder="如：zhangsan@example.com"
            value={props.initial?.email ?? ""}
            backgroundColor={OpenCodeTheme.selection}
            textColor={OpenCodeTheme.text}
            focusedBackgroundColor={OpenCodeTheme.selection}
            focusedTextColor={OpenCodeTheme.text}
            placeholderColor={OpenCodeTheme.textMuted}
            onInput={(v: string) => setEmail(v)}
            onSubmit={submit}
            onKeyDown={(e: KeyEvent) => onKeyNavigation(e, FOCUS_EMAIL)}
          />
        </box>

        {error() ? <text fg={OpenCodeTheme.error}>⚠ {error()}</text> : null}

        <box marginTop={1} flexDirection="row" justifyContent="flex-end">
          <box
            ref={(el) => (buttonRef = el as BoxRenderable)}
            paddingX={2}
            backgroundColor={buttonFocused() ? OpenCodeTheme.primary : OpenCodeTheme.selection}
            focusable
            onMouseDown={() => {
              focusField(FOCUS_BUTTON);
              submit();
            }}
            onKeyDown={(e: KeyEvent) => onKeyNavigation(e, FOCUS_BUTTON)}
          >
            <text
              fg={buttonFocused() ? OpenCodeTheme.background : OpenCodeTheme.text}
              attributes={TextAttributes.BOLD}
            >
              确认
            </text>
          </box>
        </box>

        <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
          提示：Tab / Shift+Tab 切换焦点，回车提交，也可鼠标点击按钮。
        </text>
      </box>
    </box>
  );
};

export default LoginScreen;
