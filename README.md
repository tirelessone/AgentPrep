# AgentPrep

[![CI](https://github.com/tirelessone/AgentPrep/actions/workflows/ci.yml/badge.svg)](https://github.com/tirelessone/AgentPrep/actions/workflows/ci.yml)

AgentPrep 是面向 Agent / LLM 岗秋招的 mobile-first、local-first AI 学习 PWA。它把刷题、错题、收藏、间隔复习和学习数据备份放在浏览器本地完成，并把可选的 AI Tutor 隔离在服务端，避免核心学习流程依赖网络或模型服务。

项目同时提供题库来源治理能力：每道题都必须记录来源、版本、许可证、转换方式和审核状态；外部内容先进入隔离区，只有通过人工审核与 schema 校验后才能进入发布 manifest。

> 当前状态：Phase 0–4 已完成，属于可演示、可继续迭代的 v1 release candidate。核心离线学习闭环、可选 AI Tutor、内容治理和 CI 均已实现；账号、云同步、向量数据库、微服务和多智能体不在第一版范围。

## 项目是否开发完成？

按 [ROADMAP](ROADMAP.md) 定义的第一版范围，项目已经开发完成并通过自动化验证，可以用于本地学习、功能演示和作品集展示。但它不是包含所有未来能力的商业化成品：

- 核心功能可直接使用：刷题、错题、收藏、到期复习、离线刷新、PWA 安装、学习数据导入导出。
- AI Tutor 已实现，但属于可选在线增强；只有配置兼容 provider 后才会调用真实模型。
- 仓库只包含经过治理的原创小样题库，不以抓取或复制未明确授权题库来扩充数量。
- 尚未提供账号、跨设备同步、运营后台和公共托管服务。

## 核心能力

- **Local-first 学习闭环**：学习记录保存在 IndexedDB；Server 离线时仍可刷题、查看错题、收藏、复习和备份。
- **提交前答案隔离**：选择题提交前不在可见 DOM 或 Tutor 请求中暴露标准答案。
- **间隔复习**：根据作答结果生成复习计划，并在首页展示到期任务。
- **安全备份**：导出和恢复作答、收藏、复习计划与设置；备份不包含 API Key。
- **可选 AI Tutor**：支持 `zero_base`、`wrong_reason`、`interview_scope`、`socratic`、`similar_question` 和 `free_chat`。
- **SSE 流式服务**：支持流式返回、取消、超时、安全降级和可测试 mock provider。
- **资源预算**：限制请求体、上下文字段、请求频率和模型输出 tokens。
- **内容治理**：独立 importer、隔离区、人工审核、来源报告和第三方许可证校验。
- **工程质量**：Vitest、Testing Library、Playwright、包体预算和 GitHub Actions CI。

## 架构概览

```text
版本化题库 manifest ──> Web PWA ──> IndexedDB 学习记录
                           │
                           └─ 提交答案后 ─> Fastify SSE ─> OpenAI-compatible provider

外部内容 ─> 独立 importer ─> quarantine ─> 人工审核 ─> 发布 manifest
```

题库、学习状态、UI 和模型适配器保持解耦。浏览器不保存 provider API Key，模型输出也不能回写或修改标准答案。详细设计见 [架构文档](docs/architecture.md) 和 [ADR](docs/adr)。

## 环境要求

- Node.js 22 或更高版本
- pnpm 11；仓库当前声明版本为 `11.19.0`
- 如需运行 E2E：可安装 Playwright Chromium 的桌面环境

## 快速启动

```bash
git clone https://github.com/tirelessone/AgentPrep.git
cd AgentPrep
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
```

### 方式一：只启动离线学习 Web

不需要 API Key，也不需要 Server：

```bash
pnpm --filter @agentprep/web dev
```

浏览器打开 <http://localhost:5173>。刷题、错题、收藏、复习和数据导入导出均可使用；AI Tutor 会保持不可用或安全降级。

### 方式二：同时启动 Web 与 Server

```bash
pnpm dev
```

默认地址：

- Web：<http://localhost:5173>
- Server：<http://localhost:3000>
- 健康检查：<http://localhost:3000/health>

开发环境中的 Vite 会把 `/api/*` 代理到本机 Server。没有配置 API Key 时 Server 仍可启动，只有 Tutor 调用会返回安全降级消息。

### 方式三：启用真实 AI Tutor

先复制 `apps/server/.env.example` 为 `apps/server/.env`。PowerShell 示例：

```powershell
Copy-Item apps/server/.env.example apps/server/.env
```

然后只在该 Server 环境文件中填写 provider 配置：

```dotenv
OPENAI_API_KEY=your-server-only-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

再次运行 `pnpm dev`。提交一道题后，页面才会展示 AI Tutor；选择模式、输入问题并点击“询问 Tutor”即可接收流式回答。

可选资源预算：

| 变量                         |      默认值 | 作用                       |
| ---------------------------- | ----------: | -------------------------- |
| `OPENAI_MAX_OUTPUT_TOKENS`   |       `800` | 单次模型输出上限           |
| `TUTOR_BODY_LIMIT_BYTES`     |     `65536` | Tutor 请求体上限           |
| `TUTOR_RATE_LIMIT_MAX`       |        `20` | 时间窗口内单 IP 最大请求数 |
| `TUTOR_RATE_LIMIT_WINDOW_MS` |     `60000` | 限流窗口，单位毫秒         |
| `PORT`                       |      `3000` | Server 端口                |
| `HOST`                       | `127.0.0.1` | Server 监听地址            |

不要把 API Key 写入源码、Git 或任何 `VITE_*` 环境变量。不同 provider 的模型名称和兼容程度可能不同，应按其文档填写。接口细节见 [AI Tutor 文档](docs/ai-tutor.md)。

## 如何使用

1. 在首页点击“开始练习”，选择答案后提交；提交前不会显示标准答案和解析。
2. 使用题目右上角按钮收藏题目；提交后查看结果、解析和下一题。
3. 从首页进入“错题回看”“今日复习”或“我的收藏”，也可以使用底部导航切换练习与复习。
4. 配置 Server 后，在已提交题目下选择 Tutor 模式并提问；可随时取消流式请求。
5. 在“数据”页导出 JSON 备份；换浏览器或清理数据前，可用同一页面恢复经过校验的备份。
6. 在支持 PWA 安装的浏览器中点击“安装应用”，安装后可从系统入口打开。

学习记录保存在当前浏览器的 IndexedDB `agentprep` 数据库中。清除站点数据会删除本地学习记录，因此建议定期导出备份。

## 构建与验证

生产构建：

```bash
pnpm build
pnpm --filter @agentprep/web preview
```

静态预览可验证 Web 构建；生产环境如需 Tutor，必须按 [部署指南](docs/deployment.md) 将 `/api/*` 同源反向代理到 Fastify Server。

首次运行浏览器 E2E 前安装 Chromium：

```bash
pnpm --filter @agentprep/e2e exec playwright install chromium
```

一键运行全部质量门禁：

```bash
pnpm check
```

该命令依次执行格式检查、lint、内容来源报告校验、第三方声明校验、单元/组件测试、全部构建、JavaScript gzip 包体预算和 Playwright E2E。

常用的独立命令：

```bash
pnpm format:check
pnpm lint
pnpm content:verify
pnpm third-party:verify
pnpm test
pnpm build
pnpm performance:check
pnpm test:e2e
```

## 目录结构

```text
apps/web                 React + Vite PWA 与 IndexedDB 学习界面
apps/server              可选 Fastify SSE API 与 provider adapter
packages/domain          共享领域类型
packages/question-schema 题目、来源和审核状态的 Zod 契约
packages/tutor-core      Tutor 请求校验、提示边界和 provider 契约
tools/importers          外部内容转换、隔离、审核与报告工具
content/manifests        可发布的版本化题库 manifest
content/original         原创题目内容
content/quarantine       未审核或许可证待确认内容，只隔离不发布
docs/adr                 架构决策记录
tests/e2e                Playwright 移动端端到端测试
```

## 内容与原创贡献边界

应用架构、领域模型、交互、测试、文档和转换工具由 AgentPrep 独立实现，不 fork 或复制现有 408 应用代码。外部仓库只能作为功能调研对象，或在许可证允许时作为独立 importer 的输入。

未经明确授权的牛客、ky408、CodeBrick 等内容不得进入发布题库。AI 生成题必须标记为 `ai_generated`，初始审核状态只能是 `unverified`，不能自动标记为已验证。

详细规则见 [内容与许可证策略](docs/content-license-policy.md)、[内容工作流](docs/content-workflow.md)、[来源报告](content/PROVENANCE_REPORT.md) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。

## 许可证

- 应用代码采用 [MIT License](LICENSE)。
- `content/original` 与 `content/manifests` 中单独标注的 AgentPrep 原创内容采用 [CC BY 4.0](CONTENT_LICENSE.md)。
- 第三方内容继续受其原许可证约束；`content/quarantine` 中的材料不属于可发布内容。
