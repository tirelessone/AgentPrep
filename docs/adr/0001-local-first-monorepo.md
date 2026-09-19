# ADR 0001：采用 local-first pnpm monorepo

- 状态：Accepted
- 日期：2026-09-19

## 背景

核心学习功能必须在无后端时可用，同时 Web、Server、内容 schema 与 Tutor 边界需要独立测试和演进。

## 决策

采用 pnpm workspace。Web 使用 React、Vite PWA 与 Dexie；可选 API 使用 Fastify；跨应用契约放在共享 package。学习状态以 IndexedDB 为事实来源，Server 不作为核心学习数据的必需依赖。

## 后果

离线体验和本地数据迁移成为首要测试对象。未来云同步若被批准，必须作为可选复制层设计，不能悄悄改变本地事实来源。
