# ADR 0011: Local-first authenticated cloud sync

- Status: Accepted
- Date: 2026-09-20

## Context

AgentPrep 原本只把学习记录保存在单一 IndexedDB。手机与电脑需要共享进度，同时 Guest 用户、断网场景和已有本机数据不能失效。题库是所有用户共享的静态 PWA 资源，不需要进入用户数据库。

## Decision

- IndexedDB 继续作为 UI 的即时读写源；认证与云端不可用时核心学习闭环保持可用。
- 采用 Supabase Email/Password Auth 与 Postgres。浏览器通过 publishable/public key 直连，真正的账号隔离边界是所有学习表上的 RLS，而不是 UI 过滤。
- Guest 使用 `agentprep`；登录用户使用 `agentprep-user-<supabase-user-id>`。首次登录只提示合并 Guest 数据，不自动移动或删除。
- Cloud 只保存 `study_attempts`、`favorite_states`、`user_settings`。题库、reviews、认证 session 和设备元数据不进入这些表。
- Attempts append-only，按 UUID 求并集。同 UUID 不同 payload 是异常：保留已存在的 cloud row 并产生 warning。
- Favorites 使用 `isFavorite` tombstone，并按 `updatedAt` latest-write-wins；Settings 按 key 使用同一规则。
- Reviews 不做云端 merge。每次 reconcile 按 `questionId`、`attemptedAt` 重放完整 attempts，并替换本地派生结果。
- Cloud rows 在写入 IndexedDB 前通过 Zod 验证；拉取分页，上传分块，同一浏览器的 reconcile 使用单 in-flight promise 防重入。
- 不采用 CRDT、Realtime、WebSocket 或自建 Fastify 同步 API。当前数据冲突模型简单，登录、启动恢复、online、focus 与手动同步已覆盖使用场景。

## Consequences

- 本地操作立即完成；云故障只改变同步状态，不回滚学习记录。
- 两个设备最终一致，但不是实时协同编辑；前台恢复或联网后才 reconcile。
- Favorites 必须保留取消收藏 tombstone；当前不进行 tombstone GC。
- Supabase 配置与 RLS migration 是生产部署的必要外部步骤；没有配置时同一构建自动退回 Guest Local-only Mode。
- Supabase SDK 通过动态 import 进入 lazy cloud chunk，避免扩大未配置/未登录时的主启动路径。
