# AgentPrep

AgentPrep 是面向 Agent / LLM 岗秋招的 mobile-first、local-first AI 学习 PWA。目标是在无后端时仍可完成刷题、错题、收藏、复习以及数据导入导出，并为题库来源和内容审核提供可追溯记录。

> 当前状态：Phase 2。可离线完成学习闭环；提交答案后可选择连接服务端 AI Tutor。Tutor 不可用时不会影响本地学习。

## 原创贡献边界

本仓库的应用架构、领域模型、交互设计、测试、文档和转换工具由 AgentPrep 独立实现。不会 fork 或复制任何现有 408 应用代码。外部仓库只能作为功能调研对象，或在许可证允许时作为独立 importer 的输入；转换后的内容仍须保留来源、版本、许可证、转换方式与审核状态。

未经明确授权的牛客、ky408、CodeBrick 等内容不得进入仓库。AI 生成内容必须标记为 `ai_generated`，且初始审核状态只能是 `unverified`。

详细规则见 [内容与许可证策略](docs/content-license-policy.md) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。

## 技术栈

- pnpm workspace
- React + TypeScript + Vite PWA
- IndexedDB + Dexie
- Fastify TypeScript API
- Zod Schema
- Vitest + Testing Library + Playwright
- 规划中的 SSE AI Tutor 与 OpenAI-compatible provider abstraction

## 开发

要求 Node.js 22+ 与 pnpm 11+。

```bash
pnpm install
pnpm dev
```

Web 默认运行在 `http://localhost:5173`，Server 默认运行在 `http://localhost:3000`。

AI Tutor 是可选能力。复制 `apps/server/.env.example` 为本地 `.env` 并仅在 Server 进程设置 `OPENAI_API_KEY`、`OPENAI_BASE_URL` 和 `OPENAI_MODEL`。不要创建任何 `VITE_*` 密钥变量。接口和降级语义见 [AI Tutor 文档](docs/ai-tutor.md)。

## 验证

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

一键执行完整检查：

```bash
pnpm check
```

## 目录

- `apps/web`：离线优先的 PWA 客户端
- `apps/server`：可选 Fastify API；客户端核心学习功能不依赖它
- `packages/domain`：共享领域类型
- `packages/question-schema`：题目与来源元数据的 Zod 契约
- `packages/tutor-core`：AI Tutor 的纯类型边界（Phase 0 不调用模型）
- `tools/importers`：隔离的内容转换器工作区
- `content/*`：清单、原创内容和隔离区
- `docs/adr`：架构决策记录
- `tests/e2e`：端到端测试

## 本地数据

学习记录保存在浏览器 IndexedDB 的 `agentprep` 数据库中。数据页可导出和恢复 JSON 备份；备份只包含用户学习状态，不包含题库正文、标准答案或密钥。题库随 PWA 静态发布，因此离线可用；“提交前不泄露答案”指答案不会在提交前进入可见 DOM 或 Tutor 请求，而不是把离线静态资源当作秘密保存。

路线图见 [ROADMAP.md](ROADMAP.md)，架构概览见 [docs/architecture.md](docs/architecture.md)。
