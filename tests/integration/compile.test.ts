import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let outputDir: string | undefined;

afterAll(async () => {
  if (outputDir) await rm(outputDir, { recursive: true, force: true });
});

describe("独立编译产物", () => {
  test("--self-test 能加载内置课程并找到系统 Git", async () => {
    outputDir = await mkdtemp(join(tmpdir(), "lgi-compile-"));
    const output = join(outputDir, "learn-git-interactive");
    const build = Bun.spawn([process.execPath, "run", "scripts/build.ts", output], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });
    const buildCode = await build.exited;
    const buildError = await new Response(build.stderr).text();
    expect(buildCode).toBe(0);
    expect(buildError).toBe("");

    const executable = process.platform === "win32" ? `${output}.exe` : output;
    const probe = Bun.spawn([executable, "--self-test"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(probe.stdout).text(),
      new Response(probe.stderr).text(),
      probe.exited,
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("learn-git-interactive ok: 34 lessons;");
    expect(stdout).toContain("git version");
  }, 120_000);
});
