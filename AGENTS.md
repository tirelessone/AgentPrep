# AGENTS.md

本文件适用于整个仓库。

## 产品边界

- AgentPrep 必须保持 mobile-first、local-first；核心学习路径不得依赖后端在线状态。
- 第一版不加入账号、云同步、向量数据库、微服务或多智能体。
- 不复制外部 408 项目的应用代码。外部数据只能通过 `tools/importers` 的独立转换流程进入隔离区。
- 不导入许可证不明确或明确禁止再分发的内容。
- AI 不得修改标准答案；选择题提交前不得向模型或 UI 泄露标准答案。
- AI 生成题一律标记为未验证，只有人工审核流程可以改变审核状态。
- API Key 只允许存在于服务端环境变量中，不得写入客户端源码、Vite 环境变量或 Git。

## 内容变更

每道题都必须通过 `@agentprep/question-schema` 校验，并记录：

- `source`：稳定来源标识和原始定位信息
- `sourceVersion`：来源版本、提交哈希或抓取日期
- `license`：可核验的许可证标识或授权说明
- `transform`：转换工具、版本和步骤
- `reviewStatus`：`unverified`、`reviewed` 或 `rejected`

未知来源或许可证存疑的内容只能放入 `content/quarantine`，不得进入产品构建。

## 工程约定

- 保持题库、领域逻辑、UI 和服务端适配器解耦。
- 共享边界优先使用 Zod schema，并从 schema 推导 TypeScript 类型。
- 新功能必须包含与风险相称的单元、集成或 E2E 测试。
- 每个阶段结束前运行 `pnpm format:check`、`pnpm lint`、`pnpm test`、`pnpm build` 和 `pnpm test:e2e`。
- 内容变更后运行 `pnpm content:report` 和 `pnpm third-party:report`，并确保对应 verify 命令通过。
- Web 生产构建必须满足 `pnpm performance:check` 的 JavaScript gzip 预算。
- 提交保持单一目的，不混入生成物、密钥、无关格式化或题库批量变更。
- 修改架构边界时新增或更新 ADR；不要悄悄改变既有决策。

## Git 与安全

- 禁止提交 `.env`、真实 API Key、用户学习数据和未经审核的外部内容。
- 不使用破坏性 Git 命令覆盖协作者工作。
- 提交消息使用简短祈使句，并让提交内容可独立验证。
