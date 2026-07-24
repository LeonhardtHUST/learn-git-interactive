/**
 * 系统 Git 可执行文件定位
 *
 * 课程依赖用户已安装的系统 Git CLI，而非用 JavaScript 模拟 Git。
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let cachedGitPath: string | null = null;

/** 平台已知安装位置（优先于 PATH，避免命中某些嵌入式/便携版 Git 的启动开销） */
function knownInstallCandidates(): string[] {
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const localAppData = process.env.LOCALAPPDATA;
    const candidates = [
      join(programFiles, "Git", "cmd", "git.exe"),
      join(programFilesX86, "Git", "cmd", "git.exe"),
    ];
    if (localAppData) candidates.push(join(localAppData, "Programs", "Git", "cmd", "git.exe"));
    return candidates;
  }
  return ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"];
}

/** 定位系统 Git 可执行文件的绝对路径；找不到时抛出错误 */
export function findGitExecutable(): string {
  if (cachedGitPath) return cachedGitPath;

  // 1. 显式覆盖（调试/特殊环境）
  const override = process.env.LGI_GIT_PATH;
  if (override && existsSync(override)) {
    cachedGitPath = override;
    return override;
  }

  // 2. 平台已知安装位置
  for (const candidate of knownInstallCandidates()) {
    if (existsSync(candidate)) {
      cachedGitPath = candidate;
      return candidate;
    }
  }

  // 3. PATH
  const found = Bun.which("git");
  if (!found) {
    throw new Error("未找到系统 Git。请先安装 Git（https://git-scm.com/downloads）后再运行课程。");
  }
  cachedGitPath = found;
  return found;
}

/** 查询系统 Git 版本字符串（如 "git version 2.45.0"） */
export async function gitVersion(): Promise<string> {
  const git = findGitExecutable();
  const proc = Bun.spawn([git, "--version"], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return stdout.trim();
}

/** 仅用于测试：重置缓存 */
export function resetGitExecutableCache(): void {
  cachedGitPath = null;
}
