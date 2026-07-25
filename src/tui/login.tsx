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
      backgroundColor="#1a1b26"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <box
        borderStyle="single"
        borderColor="#7aa2f7"
        padding={2}
        width={60}
        flexDirection="column"
        backgroundColor="#24283b"
      >
        <text fg="#7aa2f7" attributes={TextAttributes.BOLD}>
          🎓 Git 交互式课程
        </text>
        <text fg="#c0caf5">首次使用，请设置你的 Git 身份：</text>
        <text fg="#565f89" attributes={TextAttributes.DIM}>
          姓名与邮箱会用于课程里的配置任务（如 git config user.name）。
        </text>

        <text fg="#9ece6a">姓名</text>
        <input
          ref={(el) => (nameRef = el as InputRenderable)}
          placeholder="如：张三"
          value={name()}
          focused
          onInput={(v: string) => setName(v)}
          onSubmit={onNameSubmit}
        />

        <text fg="#9ece6a">邮箱</text>
        <input
          ref={(el) => (emailRef = el as InputRenderable)}
          placeholder="如：zhangsan@example.com"
          value={email()}
          onInput={(v: string) => setEmail(v)}
          onSubmit={submit}
        />

        {error() ? <text fg="#f7768e">⚠ {error()}</text> : null}

        <text fg="#565f89" attributes={TextAttributes.DIM}>
          提示：在姓名处回车切到邮箱，在邮箱处回车确认提交。
        </text>
      </box>
    </box>
  );
};

export default LoginScreen;
