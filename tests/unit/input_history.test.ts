import { describe, expect, test } from "bun:test";
import { CommandHistoryNavigator } from "../../src/tui/input_history";

describe("CommandHistoryNavigator", () => {
  test("上键从最新浏览至最旧，下键恢复提交前草稿", () => {
    const navigator = new CommandHistoryNavigator();
    const history = ["git status", "git add .", "git commit -m init"];
    expect(navigator.previous(history, "git st")).toBe("git commit -m init");
    expect(navigator.previous(history, "ignored")).toBe("git add .");
    expect(navigator.previous(history, "ignored")).toBe("git status");
    expect(navigator.previous(history, "ignored")).toBe("git status");
    expect(navigator.next(history)).toBe("git add .");
    expect(navigator.next(history)).toBe("git commit -m init");
    expect(navigator.next(history)).toBe("git st");
    expect(navigator.next(history)).toBeUndefined();
  });

  test("空历史与重置不产生伪输入", () => {
    const navigator = new CommandHistoryNavigator();
    expect(navigator.previous([], "draft")).toBeUndefined();
    navigator.previous(["git status"], "draft");
    navigator.reset();
    expect(navigator.next(["git status"])).toBeUndefined();
  });
});
