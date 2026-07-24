import { describe, expect, test } from "bun:test";
import {
  assertSafeCommandPaths,
  assertSafeRelativePath,
  PathViolation,
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
});
