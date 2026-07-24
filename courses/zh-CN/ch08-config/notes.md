# 第 8 章 Git 配置与钩子（明确说明 / 暂未提供交互实验）

本章对应《Pro Git》第二版第 8 章，讲解用配置与钩子定制 Git 行为。

## 关键概念

- **配置层级（优先级从低到高）**
  - `--system`：整台机器（通常 `/etc/gitconfig`）。
  - `--global`：当前用户（`~/.gitconfig`）。
  - `--local`：当前仓库（`.git/config`）。
  - 查看来源：`git config --list --show-origin`。
- **gitattributes**：按路径设置文本换行（eol）、自定义合并/差异驱动、标识二进制文件等。
- **钩子（hooks）**：`.git/hooks/` 下的脚本，在提交、推送、接收等时机自动运行（如 `pre-commit`、`pre-push`、`post-receive`）。

## 本路线覆盖情况

- `ch01-start/01-config` 已演练 `git config --global user.name/user.email`。
- 课程沙箱**有意禁用钩子与外部 pager/editor/credential**（见 `src/git/environment.ts`），避免课程命令触发用户自定义脚本——这是安全边界，详见 `tests/integration/security.test.ts` 第 1、4 项。
- 计划：在 v1 增加「用 `core.hooksPath` 配置项目级钩子」「用 gitattributes 统一换行」的说明性实验。

## 参考

- https://git-scm.com/book/zh/v2/自定义-Git-配置-Git
- https://git-scm.com/book/zh/v2/自定义-Git-Git-钩子
