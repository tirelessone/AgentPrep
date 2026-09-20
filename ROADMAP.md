# AgentPrep Roadmap

## Phase 0 — 工程基础

- [x] 初始化 Git 与 pnpm workspace
- [x] 建立 Web、Server 和共享包骨架
- [x] 固化原创贡献、内容溯源和安全边界
- [x] 配置格式检查、lint、单测、E2E、build 与 CI
- [x] 创建首个绿色提交

退出条件：空白仓库可复现安装，所有检查通过，未导入题库、未发起模型调用。

## Phase 1 — Local-first 学习闭环

- [x] 定义稳定的题库 manifest 与版本迁移策略
- [x] 实现原创小样题库和安全导入/导出
- [x] 用 Dexie 实现作答、错题、收藏与复习队列
- [x] 完成选择题提交前答案隔离
- [x] 覆盖离线刷新、持久化和数据迁移 E2E

## Phase 2 — 可选 AI Tutor

- [x] 实现服务端 OpenAI-compatible provider adapter 与可测试 mock provider
- [x] 实现 SSE 流式返回、取消、超时和错误降级
- [x] 支持 `zero_base`、`wrong_reason`、`interview_scope`、`socratic`、`similar_question`、`free_chat`
- [x] 建立标准答案不可变与提交前不可泄露测试

## Phase 3 — 内容工具与发布准备

- [x] 实现独立 importer、隔离区和人工审核流程
- [x] 生成内容溯源报告与第三方声明
- [x] 完善无障碍、性能、安装体验和恢复测试
- [x] 发布静态 Web 与可选 Server 部署指南

## Phase 4 — 发布加固

- [x] 为 Tutor 请求体和上下文字段设置明确预算
- [x] 为 Tutor 接口增加可配置的单 IP 限流
- [x] 为 OpenAI-compatible 调用设置可配置的输出 token 上限
- [x] 覆盖超限、限流与 provider 请求参数测试

## Question Domain v2 — 面试题型建模

- [x] 增加学科、章节、知识点和重要度分类
- [x] 用判别联合正式区分单选、多选、判断和口述题
- [x] 隔离题目提示与答案揭示，避免提交前泄露
- [x] 升级原创 manifest，并保持现有学习记录兼容
- [x] 为四类题型补齐校验、作答和渲染测试

## Content Taxonomy + Practice Selection — 专项刷题

- [x] 建立九个学科及 canonical chapter catalog
- [x] 为学科、章节和难度提供统一中文展示层
- [x] 在发布门禁校验 subject/chapter 组合
- [x] 按学科、章节和全部/未做/错题/收藏模式生成练习队列
- [x] 使用批量 IndexedDB 查询避免逐题 N+1 查询

## Account + Cloud Sync + Production PWA

- [x] 将收藏升级为 tombstone + LWW，并迁移到 Dexie v3、Backup v2
- [x] 按 Supabase user id 隔离本地数据库，并保留 Guest 模式与确认式本机记录合并
- [x] 以 append-only attempts、LWW favorites/settings 和派生 reviews 实现双向 reconcile
- [x] 接入可选 Supabase Email/Password Auth、Postgres、RLS 与运行时远端数据校验
- [x] 增加 Vercel 静态 PWA 配置、移动端账号体验和无 secrets 的 Fake Cloud E2E

## Windows Desktop App

- [x] 在现有 React/Vite 应用内加入 Tauri 2 Windows shell，不复制前端
- [x] 分离 Web/PWA 与 Desktop build mode，并让桌面包直接加载内置静态题库
- [x] 保留 Dexie/IndexedDB、可选 Supabase 同步和浏览器备份迁移路径
- [x] 在 Desktop dev/production 中隐藏 PWA 安装入口并禁用 AI Tutor
- [ ] 在具备 MSVC C++ Build Tools 与 Windows SDK 的机器上生成、安装并完成 NSIS 离线 smoke test

仍不在当前范围：向量数据库、微服务、复杂 realtime/CRDT、多智能体、管理员后台、社交功能和 Tutor 公网部署。
