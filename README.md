# learn-git-interactive

本地可运行的中文交互式 Git 课程。课程以《Pro Git》第二版简体中文版为知识主线，
用户在**隔离的真实 Git 仓库**中完成任务，程序根据仓库实际状态判定是否通关。

> 终端交互借鉴 OpenCode TUI 的全屏会话流、底部输入与 `/` 命令面板风格；不复用
> OpenCode 的名称、标识或资源。

## 特性

- **真实 Git，不是模拟器**：直接调用系统 Git CLI，行为与你日常使用完全一致。
- **隔离沙箱**：每次学习在独立目录中运行 Git，环境变量被清理、危险参数被拒绝、
  只放行本地 `file` 协议远程，绝不读取或修改你的真实 Git 配置。
- **按状态判题**：判题器检查工作区、暂存区、提交树、分支、标签、远程跟踪、冲突、
  reflog、对象类型等真实状态，同一目标允许多种正确命令序列。
- **MVP 课程**：22 个可连续学习的实验，覆盖《Pro Git》第 1～3 章与第 7 章高频工具
  （从 `init` 一路学到 `rebase` / `reflog` / `stash`）。
- **进度持久化**：完成的关卡写入用户数据目录，退出后可恢复。
- **课程契约测试**：自动回放每道关卡的参考解法并断言可通关，作为关卡可解性的硬性保证。

## 安装与运行

### 前置条件

- [Bun](https://bun.sh/) ≥ 1.3（开发与运行均使用 Bun + TypeScript）
- 系统已安装 [Git](https://git-scm.com/downloads)（课程依赖 Git CLI，不模拟 Git）

### 命令

```bash
bun install            # 安装依赖
bun run dev            # 启动课程（开发模式，带文件监听）
bun run start          # 启动课程
bun run check          # 质量门禁：格式 + lint + 类型检查 + 测试
bun run test           # 仅运行测试（含课程契约测试与安全回归测试）
bun run compile        # 编译为独立可执行文件到 ./dist
```

### 课程结构

课程定义于 `courses/zh-CN/`，按章节组织，每道关卡是一个独立 YAML 文件：

| 章节 | 内容 | 状态 |
| --- | --- | --- |
| `ch01-start` | 起步：配置、init、首个提交 | ✅ 实验 |
| `ch02-basics` | 基础：status/add/commit/.gitignore/diff/log/amend/restore/unstage/revert/tag/alias | ✅ 实验 |
| `ch03-branch` | 分支：创建切换、合并、冲突、推送、拉取、变基 | ✅ 实验 |
| `ch04-protocol` | 服务器上的 Git（协议、bare 仓库） | 📝 大纲 |
| `ch05-distributed` | 分布式工作流 | 📝 大纲 |
| `ch06-github` | GitHub 协作（fork / PR） | 📝 大纲 |
| `ch07-tools` | 高频工具：reflog 找回、stash 暂存 | ✅ 实验 |
| `ch08-config` | 配置层级、attributes、钩子 | 📝 大纲 |
| `ch09-migration` | 从其它版本控制系统迁移 | 📝 大纲 |
| `ch10-internals` | Git 内部原理（对象、引用、packfile） | 📝 大纲 |

✅ 实验：有完整 fixture / 判题 / 参考解法，并被课程契约测试覆盖；
📝 大纲：关键概念与已有实验的映射见对应章节的 `notes.md`（计划书允许「实验或明确说明」）。
全部 10 章已在 `course.yaml` 中登记。

## 安全模型

课程提供「隔离式 Git 实验环境」，核心约束：

- 每次 Git 子进程使用清理后的环境变量，不继承用户的 `GIT_*` / `GPG_*` / `SSH_*` /
  `HOME` 等；`GIT_CONFIG_GLOBAL` 指向会话内的沙箱配置。
- 用户输入**不经过 shell**：词法解析 → 关卡能力策略 → 路径边界检查 → 参数数组 → Git。
- 默认拒绝 `-C` / `-c` / `--git-dir` / `--work-tree` 等全局参数，拒绝绝对路径、`..` 逃逸、
  拒绝 shell alias（`alias.*=!…`）与外部命令配置。
- 运行时禁用 hook、credential helper、外部 pager/editor 与网络协议，仅允许本地 `file` remote。

上述约束由 `tests/integration/security.test.ts` 的 7 项安全回归测试守护
（恶意伪环境被忽略、真实配置哈希不变、来源仅沙箱、危险参数被拒、bare remote 正常）。

## 授权与许可

课程内容（讲解、任务、状态图）改编自《Pro Git》第二版，原作者 Scott Chacon 与 Ben Straub，
中文翻译由 [《Pro Git》简体中文翻译项目](https://git-scm.com/book/zh/v2/) 完成。

- **课程内容**采用 [CC BY-NC-SA 3.0](LICENSE-CC-BY-NC-SA-3.0) 许可：
  署名（Scott Chacon、Ben Straub 及中文翻译项目）、非商业性使用、相同方式共享。
  本课程使用原创的讲解与任务设计，未大段复制原书文本。
- **程序代码**采用 [MIT](LICENSE) 许可（见 `LICENSE`）。

若未来进行商业发行，须重新审查课程内容的授权边界。

## 目录结构

```text
src/
  main.ts          入口
  tui/             终端界面（OpenTUI Solid）
  course/          课程与关卡数据模型、加载器
  grader/          仓库状态判定系统
  progress/        学习进度持久化
  git/             受限 Git 命令执行器、解析、策略、路径守卫
  sandbox/         隔离式实验环境与 fixture 构建
courses/zh-CN/     课程内容（章节 / 关卡 YAML）
tests/
  unit/            单元（解析、策略、进度）
  integration/     集成（判题、沙箱隔离、安全回归）
  course_contract/ 课程契约（每关参考解法可通关）
```

详见各模块源码注释与 `courses/zh-CN/*/notes.md`。
