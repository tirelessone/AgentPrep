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

明确不在第一版范围：账号、云同步、向量数据库、微服务、多智能体。
