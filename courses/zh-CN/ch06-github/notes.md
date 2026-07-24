# 第 6 章 GitHub（明确说明 / 暂未提供交互实验）

本章对应《Pro Git》第二版第 6 章，介绍以 GitHub 为代表的托管平台协作模型。

## 关键概念

- **Fork**：把别人的仓库复制到自己的账号下，获得推送权限。
- **Pull Request（PR）**：请求上游把你的分支合并进去，附带讨论、评审与 CI。
- **Issue / 讨论 / 项目看板**：需求与缺陷的跟踪。
- **组织（Organization）与团队**：多人对同一组仓库的权限管理。
- **GitHub API / gh CLI**：自动化创建 PR、管理 Issue、读写仓库元数据。

## 本路线覆盖情况

- 真实 GitHub 交互需要网络与账号凭据，超出「默认离线」本地课程范围。
- 其底层动作（clone 他人仓库、在自己分支开发、push、让别人 pull/merge）已在本地用多个 clone（`alice` 等协作者）与 `ch03-branch` 的 push/pull/conflict 演练，对应 PR 评审流程的「本地版」。
- 计划：在 v1 通过 GitHub CLI 集成（需用户授权）提供「发起 PR / 查看 CI」的只读说明与可选实验。

## 参考

- https://git-scm.com/book/zh/v2/GitHub-账户与配置
- https://git-scm.com/book/zh/v2/GitHub-参与一个项目
