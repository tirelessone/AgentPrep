# AgentPrep

[![CI](https://github.com/tirelessone/AgentPrep/actions/workflows/ci.yml/badge.svg)](https://github.com/tirelessone/AgentPrep/actions/workflows/ci.yml)

AgentPrep 是面向 Agent / LLM 岗秋招的 mobile-first、local-first AI 学习 PWA。它把刷题、错题、收藏、间隔复习和学习数据备份优先放在浏览器本地完成；账号完全可选，登录后可通过 Supabase 在手机和电脑之间同步学习状态。可选 AI Tutor 仍隔离在服务端，核心学习流程不依赖网络或模型服务。

项目同时提供可追溯的内容转换能力：每道外部题目保留来源、版本、仓库许可证、转换方式和审核状态，并在进入产品前通过专用 importer 与 schema 校验。

> 当前状态：核心离线学习闭环、Question Domain v2、专项刷题、真实计算机网络题库、可选账号、跨设备云同步、Vercel 部署配置、可选 AI Tutor、内容溯源和 CI 均已实现。仓库已 deployment-ready；真实 Supabase Project 和 Vercel Production Deployment 仍需项目维护者执行一次外部配置。

## 项目是否开发完成？

按 [ROADMAP](ROADMAP.md) 当前范围，项目代码已经完成并可用于本地学习、功能演示和作品集展示。生产账号能力需先按 [部署指南](docs/deployment.md) 配置 Supabase 与 Vercel；它仍不是包含所有未来能力的商业化成品：

- 核心功能可直接使用：刷题、错题、收藏、到期复习、离线刷新、PWA 安装、学习数据导入导出。
- 不登录时使用 Guest 本地模式；登录后 attempts、收藏和普通学习设置可跨设备同步，reviews 从 merged attempts 确定性重建。
- AI Tutor 已实现，但属于可选在线增强；只有配置兼容 provider 后才会调用真实模型。
- 仓库内置 AgentPrep 原创 Agent / LLM 示例内容，以及通过独立 importer 标准化的 408 Computer Network 题集。
- 尚未提供运营后台、社交系统、复杂 realtime/CRDT、云端 Tutor 或由仓库维护者提供的公共托管实例。

## 核心能力

- **Local-first 学习闭环**：学习记录保存在 IndexedDB；Server 离线时仍可刷题、查看错题、收藏、复习和备份。
- **可选账号与跨设备同步**：Email/Password Auth 由 Supabase 管理；所有学习操作先写 IndexedDB，联网后自动 reconcile。
- **账号隔离**：每个用户拥有独立本地数据库，云端通过 Row Level Security 强制 `auth.uid() = user_id`。
- **四类正式题型**：单选题、多选题、判断题和口述题分别建模；多选使用复选框，口述题通过参考答案与要点自评。
- **结构化知识分类**：题目记录学科、章节、知识点、难度和 1–5 重要度，便于后续做可追溯的内容扩充。
- **专项练习选择**：按有题目的学科、canonical 章节和全部/未做/错题/收藏模式生成稳定练习队列。
- **真实网络题库**：内置约 500 道计算机网络单选题，覆盖网络体系结构、物理层、数据链路层、网络层、传输层和应用层。
- **可控 Session**：支持 20 题、50 题或全部题目，并可选择随机或顺序练习；队列进入 Session 后保持固定。
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
版本化静态题库 ──> Web PWA ──> IndexedDB（即时读写）
                        │              │
                        │              └─ 可选登录 ─> Supabase Auth + Study State + RLS
                        │
                        └─ 本地开发可选 ─> Fastify SSE ─> OpenAI-compatible provider

外部内容 ─> 独立 importer ─> 校验与报告 ─> 发布 manifest
```

题库、学习状态、UI、云存储和模型适配器保持解耦。浏览器只允许 Supabase public/publishable key，不保存 provider API Key、service role key 或密码；模型输出也不能回写或修改标准答案。详细设计见 [架构文档](docs/architecture.md) 和 [ADR](docs/adr)。

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

如需本地测试账号同步，复制 `apps/web/.env.example` 为 `apps/web/.env.local`，只填写 Supabase Project URL 和 public/publishable key。未配置时不会报错，应用自动保持 Guest 模式。

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

1. 在首页点击“开始刷题”，选择有题目的学科、全部或具体章节，以及全部题目、未做题、错题或收藏模式；再选择 20/50/全部题量与随机/顺序。
2. 进入专项 Session 后，单选题选择一个答案，多选题可勾选多个答案，判断题选择正确或错误；提交前不会显示标准答案和解析。
3. 遇到口述题时先独立作答，再查看参考答案、回答要点和可选追问，最后选择“已掌握”或“需要复习”。
4. 使用题目右上角按钮收藏题目；提交后查看结果、解析和下一题。
5. 从首页进入“错题回看”“今日复习”或“我的收藏”，也可以使用底部导航切换练习与复习。
6. 配置 Server 后，可在已提交的选择题下选择 Tutor 模式并提问；可随时取消流式请求。
7. 可直接保持 Guest 模式；也可以从顶部“登录 / 注册”进入账号页。首次登录检测到 Guest 记录时，需明确选择是否合并。
8. 登录后在账号页或“数据”页查看同步状态、最近同步时间并手动同步；离线操作会保留在本地，恢复联网后自动同步。
9. 在“数据”页导出 JSON 备份；换浏览器或清理数据前，可用同一页面恢复经过校验的备份。
10. 在支持 PWA 安装的浏览器中点击“安装应用”，安装后可从系统入口打开。

Guest 学习记录保存在 IndexedDB `agentprep`；登录用户使用 `agentprep-user-<user-id>`，同一设备的不同账号不会共享缓存。清除站点数据会删除本地缓存，因此即使启用云同步也建议保留必要备份。

## 构建与验证

生产构建：

```bash
pnpm build
pnpm --filter @agentprep/web preview
```

静态预览可验证 Web 构建。当前 Vercel 阶段只部署 PWA 与 Supabase 学习同步，不部署 Fastify Tutor；完整一次性配置与 RLS 验收见 [部署指南](docs/deployment.md)。

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
supabase/migrations      学习状态表、索引和 RLS 的正式 SQL migration
packages/domain          共享领域类型
packages/question-schema 题目、来源和审核状态的 Zod 契约
packages/taxonomy        学科、章节及中文展示的 canonical catalog
packages/tutor-core      Tutor 请求校验、提示边界和 provider 契约
tools/importers          外部内容转换、隔离、审核与报告工具
content/manifests        可发布的版本化题库 manifest
content/external         专用 importer 生成的可追溯外部题库、报告与来源说明
content/original         原创题目内容
content/quarantine       未审核或许可证待确认内容，只隔离不发布
docs/adr                 架构决策记录
tests/e2e                Playwright 移动端端到端测试
```

## 内容与原创贡献边界

应用架构、领域模型、交互、测试、文档和转换工具由 AgentPrep 独立实现，不 fork 或复制现有 408 应用代码。

仓库内的 408 Computer Network 题集由专用 importer 转换自 [lij768423-svg/408-](https://github.com/lij768423-svg/408-) 的固定提交 `267d0d815b1eee770dad12e88bbd560d08ba3f66`。AgentPrep 保留原始题目 ID、来源版本与转换记录，不将该题集表述为 AgentPrep 自有内容。具体范围和跳过项见 [SOURCE.md](content/external/408/SOURCE.md) 与 [import-report.json](content/external/408/import-report.json)。

未经明确授权的牛客、ky408、CodeBrick 等内容不得进入发布题库。AI 生成题必须标记为 `ai_generated`，初始审核状态只能是 `unverified`，不能自动标记为已验证。

详细规则见 [内容与许可证策略](docs/content-license-policy.md)、[内容工作流](docs/content-workflow.md)、[来源报告](content/PROVENANCE_REPORT.md) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。

## 许可证

- 应用代码采用 [MIT License](LICENSE)。
- `content/original` 与 `content/manifests` 中单独标注的 AgentPrep 原创内容采用 [CC BY 4.0](CONTENT_LICENSE.md)。
- 第三方内容继续受其原许可证约束；`content/quarantine` 中的材料不属于可发布内容。
