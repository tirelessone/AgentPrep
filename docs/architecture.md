# 架构概览

## 运行边界

AgentPrep 以 Web PWA 为主应用。版本化题库 manifest 与题图作为静态资源发布并由 Service Worker 预缓存；学习记录和复习状态保存在浏览器 IndexedDB 中。断网或 Server 不可用时，核心学习闭环仍应工作。

```text
taxonomy catalog -> question-schema -> static content manifests -> Web PWA
                                                              |          |
                                                              |          +--> IndexedDB (Dexie)
                                                              |
                                                              +-- optional HTTPS/SSE --> Fastify API
                                                                                       |
                                                                                       +--> model provider
```

Server 是可选增强层，只负责不能安全放进浏览器的能力，例如持有模型凭据和代理流式模型调用。浏览器包不得包含模型 API Key。

## 包职责

- `domain`：不依赖 UI 或存储实现的学习领域类型。
- `taxonomy`：学科、canonical 章节、排序和中文展示名称的共享目录。
- `question-schema`：题目格式和来源元数据的运行时验证，是内容进入产品的门禁。
- `tutor-core`：Tutor 模式和 provider 流式契约；Phase 0 仅定义边界。
- `web`：页面、PWA、Dexie 适配器和离线交互。
- `server`：Fastify 入口和未来的服务端模型适配器。

## 关键数据流

1. 原创内容进入 `content/manifests`；固定外部来源通过专用 importer 生成 `content/external` manifest、报告和静态题图。
2. 每个发布 manifest 先独立通过 schema 校验，再按固定顺序合并；重复题目 ID 直接失败，不允许后加载覆盖。
3. 发布门禁使用 taxonomy 校验 subject/chapter 组合；knowledgePoints 仍是开放字符串列表。
4. Web 将作答、收藏和复习状态独立写入 IndexedDB v2；内容升级不覆盖学习记录。
5. 专项练习先在内存中按 subject/chapter 缩小题目范围，再针对学习模式执行至多一次 IndexedDB 批量查询；之后按随机或顺序排列、截取题量并固定本次 Session 队列。
6. 导入操作先完成大小限制、JSON 解析和 Zod 校验，再在单一事务中替换学习数据。
7. Tutor 请求只能在用户提交选择后构造；标准答案由领域层保持只读，模型响应不能回写答案字段。

Tutor 调用经过 `tutor-core` 请求校验后，由 Fastify SSE 路由转交 OpenAI-compatible provider。服务端统一施加上下文字段与请求体预算、单 IP 限流、输出 token 上限、20 秒超时、断连取消与安全错误事件；浏览器只把 `token` 事件追加到临时 UI 状态，不写入题库。

题库 JSON 不进入主 JavaScript bundle。Vite 在开发和构建时从正式内容目录提供静态 manifest，Workbox 将 manifest 与题图加入预缓存。答案不被视为客户端秘密；产品保证的是提交前不在界面 DOM 或 Tutor 请求中暴露答案。
