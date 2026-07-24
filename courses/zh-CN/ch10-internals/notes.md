# 第 10 章 Git 内部原理（明确说明 + 部分实验）

本章对应《Pro Git》第二版第 10 章，揭开 Git 的「底层对象模型」，解释为什么前面的命令如此工作。

## 关键概念

- **四种对象**：`blob`（文件内容）、`tree`（目录结构）、`commit`（快照 + 父提交 + 作者/信息）、`tag`（指向对象的可读名称）。一切皆经 SHA-1 寻址。
- **`.git` 目录**：`objects/`（松散与打包对象）、`refs/`（分支/标签指针）、`HEAD`（当前分支）、`index`（暂存区）。
- **packfile**：对象会被 `git gc` 打包压缩以节省空间。
- **refspec 与传输**：`+refs/heads/*:refs/remotes/origin/*` 描述本地/远程引用如何映射。
- **数据恢复**：`reflog`、`git fsck --lost-found`、`git gc`  pruning 前的对象都还能找回（见 `ch07-tools/01-reflog`）。

## 本路线覆盖情况

- 判题引擎本身就用 `cat-file` / `rev-parse` / `rev-list` 等 plumbing 读取这些对象，schema 已支持 `object_type` 检查类型。
- `ch07-tools/01-reflog` 已是「用 reflog 找回丢失提交」的真实实验。
- 计划：在 v1 增加「查看对象类型与内容」（`git cat-file -t/-p HEAD`）、「理解 tree 与 commit」「packfile 与 gc」的交互实验，紧扣本章原理。

## 参考

- https://git-scm.com/book/zh/v2/Git-内部原理-底层命令与上层命令
- https://git-scm.com/book/zh/v2/Git-内部原理-Git-引用
