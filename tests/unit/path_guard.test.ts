import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSafeCommandPaths,
  assertSafeRelativePath,
  PathViolation,
  resolveSafePathInsideRepo,
} from "../../src/git/path_guard";

describe("assertSafeRelativePath", () => {
  test("允许普通相对路径", () => {
    expect(() => assertSafeRelativePath("README.md")).not.toThrow();
    expect(() => assertSafeRelativePath("src/main.ts")).not.toThrow();
  });

  test("拒绝 POSIX 绝对路径", () => {
    expect(() => assertSafeRelativePath("/etc/passwd")).toThrow(PathViolation);
  });

  test("拒绝 Windows 绝对路径", () => {
    expect(() => assertSafeRelativePath("C:\\Windows\\system32")).toThrow(PathViolation);
    expect(() => assertSafeRelativePath("C:/Users/leon")).toThrow(PathViolation);
  });

  test("拒绝 UNC 路径", () => {
    expect(() => assertSafeRelativePath("\\\\server\\share")).toThrow(PathViolation);
  });

  test("拒绝 .. 逃逸", () => {
    expect(() => assertSafeRelativePath("../outside.txt")).toThrow(PathViolation);
    expect(() => assertSafeRelativePath("a/../../outside.txt")).toThrow(PathViolation);
  });

  test("拒绝 ~ 路径", () => {
    expect(() => assertSafeRelativePath("~/secret")).toThrow(PathViolation);
  });
});

describe("assertSafeCommandPaths", () => {
  test("放行 ref 范围语法", () => {
    expect(() => assertSafeCommandPaths(["main..dev"])).not.toThrow();
    expect(() => assertSafeCommandPaths(["HEAD~2..HEAD"])).not.toThrow();
    expect(() => assertSafeCommandPaths(["a...b"])).not.toThrow();
  });

  test("放行选项", () => {
    expect(() => assertSafeCommandPaths(["--oneline", "-n", "5"])).not.toThrow();
  });

  test("拒绝 -- 之后的绝对路径", () => {
    expect(() => assertSafeCommandPaths(["--", "/etc/passwd"])).toThrow(PathViolation);
  });

  test("拒绝选项值中的绝对路径", () => {
    expect(() => assertSafeCommandPaths(["--output=/tmp/evil"])).toThrow(PathViolation);
  });

  test("拒绝选项值和短选项中的相对路径逃逸", () => {
    expect(() => assertSafeCommandPaths(["--output=../../outside"])).toThrow(PathViolation);
    expect(() => assertSafeCommandPaths(["-o../../outside"])).toThrow(PathViolation);
  });

  test("拒绝 file URI 与其它外部 URI", () => {
    expect(() => assertSafeCommandPaths(["file:///tmp/repo"])).toThrow(PathViolation);
    expect(() => assertSafeCommandPaths(["https://example.com/repo"])).toThrow(PathViolation);
  });

  test("commit 文本参数不被当成 URI 或路径", () => {
    expect(() =>
      assertSafeCommandPaths(["-m", "feat: preserve history"], undefined, "commit"),
    ).not.toThrow();
  });
});

describe("resolveSafePathInsideRepo", () => {
  test("拒绝通过存在的符号链接目录创建仓库外文件", async () => {
    const base = await mkdtemp(join(tmpdir(), "lgi-path-"));
    const repo = join(base, "repo");
    const outside = join(base, "outside");
    try {
      await mkdir(repo);
      await mkdir(outside);
      await symlink(outside, join(repo, "escape"), "junction");
      expect(() => resolveSafePathInsideRepo(repo, "escape/new.txt")).toThrow(PathViolation);
      expect(() => assertSafeCommandPaths(["escape/new.txt"], repo, "add")).toThrow(PathViolation);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
