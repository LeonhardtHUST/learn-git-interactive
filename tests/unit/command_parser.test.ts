import { describe, expect, test } from "bun:test";
import { ParseError, parseGitCommand, tokenize } from "../../src/git/command_parser";

describe("tokenize", () => {
  test("按空白切分", () => {
    expect(tokenize("git status -s")).toEqual(["git", "status", "-s"]);
  });

  test("双引号保留空格", () => {
    expect(tokenize('git commit -m "hello world"')).toEqual(["git", "commit", "-m", "hello world"]);
  });

  test("单引号保留一切", () => {
    expect(tokenize("git commit -m 'a \"b\" c'")).toEqual(["git", "commit", "-m", 'a "b" c']);
  });

  test("保留 Windows 路径中的反斜杠", () => {
    expect(tokenize("git add docs\\guide.md")).toEqual(["git", "add", "docs\\guide.md"]);
  });

  test("未闭合引号报错", () => {
    expect(() => tokenize('git commit -m "oops')).toThrow(ParseError);
  });

  test("空引号是有效词元", () => {
    expect(tokenize('git commit -m ""')).toEqual(["git", "commit", "-m", ""]);
  });
});

describe("parseGitCommand", () => {
  test("解析基本命令", () => {
    const cmd = parseGitCommand("git add README.md");
    expect(cmd.subcommand).toBe("add");
    expect(cmd.args).toEqual(["README.md"]);
  });

  test("拒绝非 git 命令", () => {
    expect(() => parseGitCommand("ls -la")).toThrow(ParseError);
  });

  test("拒绝 shell 管道", () => {
    expect(() => parseGitCommand("git log | head")).toThrow(ParseError);
  });

  test("拒绝命令替换", () => {
    expect(() => parseGitCommand("git commit -m $(whoami)")).toThrow(ParseError);
  });

  test("允许引号内的普通提交信息字符", () => {
    expect(() => parseGitCommand('git commit -m "fix(parser): keep $HOME"')).not.toThrow();
  });

  test("拒绝重定向", () => {
    expect(() => parseGitCommand("git log > out.txt")).toThrow(ParseError);
  });

  test("拒绝空输入", () => {
    expect(() => parseGitCommand("   ")).toThrow(ParseError);
  });
});
