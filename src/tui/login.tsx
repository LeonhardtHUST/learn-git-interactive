/**
 * 首次运行登录界面
 *
 * 以「登录卡片」形式居中展示，要求填写姓名与邮箱（两个输入框，可编辑）。
 * 在姓名框回车会切到邮箱框；两个框都填好后回车提交。
 * 提交后由父级（Root）负责持久化并进入主课程界面。
 */

import { TextAttributes } from "@opentui/core";
import type { InputRenderable } from "@opentui/core";
import { createSignal, type Component } from "solid-js";
import type { UserProfile } from "../progress/store";
import { OpenCodeTheme } from "./theme";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  let nameRef: InputRenderable | undefined;
  let emailRef: InputRenderable | undefined;

  const submit = () => {
    const n = name().trim();
    const e = email().trim();
    if (!n) {
      setError("请填写你的姓名。");
      nameRef?.focus();
      return;
    }
    if (!EMAIL_RE.test(e)) {
      setError("请填写有效的邮箱（如 name@example.com）。");
      emailRef?.focus();
      return;
    }
    setError("");
    props.onComplete({ name: n, email: e });
  };

  // 姓名框回车：邮箱已填则提交，否则切到邮箱框
  const onNameSubmit = () => {
    if (email().trim()) submit();
    else emailRef?.focus();
  };

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
        <input
          ref={(el) => (nameRef = el as InputRenderable)}
          placeholder="如：张三"
          value={name()}
          focused
          backgroundColor={OpenCodeTheme.selection}
          textColor={OpenCodeTheme.text}
          focusedBackgroundColor={OpenCodeTheme.selection}
          focusedTextColor={OpenCodeTheme.text}
          placeholderColor={OpenCodeTheme.textMuted}
          onInput={(v: string) => setName(v)}
          onSubmit={onNameSubmit}
        />

        <text fg={OpenCodeTheme.secondary}>邮箱</text>
        <input
          ref={(el) => (emailRef = el as InputRenderable)}
          placeholder="如：zhangsan@example.com"
          value={email()}
          backgroundColor={OpenCodeTheme.selection}
          textColor={OpenCodeTheme.text}
          focusedBackgroundColor={OpenCodeTheme.selection}
          focusedTextColor={OpenCodeTheme.text}
          placeholderColor={OpenCodeTheme.textMuted}
          onInput={(v: string) => setEmail(v)}
          onSubmit={submit}
        />

        {error() ? <text fg={OpenCodeTheme.error}>⚠ {error()}</text> : null}

        <text fg={OpenCodeTheme.textMuted} attributes={TextAttributes.DIM}>
          提示：在姓名处回车切到邮箱，在邮箱处回车确认提交。
        </text>
      </box>
    </box>
  );
};

export default LoginScreen;
