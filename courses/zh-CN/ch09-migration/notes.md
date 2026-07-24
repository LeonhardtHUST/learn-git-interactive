# 第 9 章 迁移到其他系统（明确说明 / 暂未提供交互实验）

本章对应《Pro Git》第二版第 9 章，讨论把既有版本库从其他系统迁移到 Git。

## 关键概念

- **`git svn`**：双向桥接 Subversion，可把 SVN 历史拉成 Git 提交，也能把 Git 提交推回 SVN。
- **从 Mercurial 迁移**：`hg-fast-export` 等工具将 Hg 导出为 fast-import 流。
- **从 Perforce / TFS 迁移**：官方或社区 importer，保留分支与提交元数据。
- **通用入口 `git fast-import`**：把任意格式的导出流快速灌入 Git 仓库。

## 本路线覆盖情况

- 此类迁移通常依赖外部系统的客户端与历史数据，无法在「仅依赖系统 Git」的离线沙箱中演练。
- 本章作为概念说明，帮助已有其它 VCS 经验的读者理解 Git 的对象与历史模型差异。
- 计划：在 v1 视需要增加「`git svn clone` 只读演练」（需用户本地装有 svn 客户端）。

## 参考

- https://git-scm.com/book/zh/v2/迁移到-Git-迁移到-Git
