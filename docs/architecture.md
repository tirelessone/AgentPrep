# 架构概览

## 运行边界

AgentPrep 以 Web PWA 为主应用。题库快照、学习记录和复习状态保存在浏览器 IndexedDB 中；断网或 Server 不可用时，核心学习闭环仍应工作。

```text
content manifest -> question-schema -> Web PWA -> IndexedDB (Dexie)
                                         |
                                         +-- optional HTTPS/SSE --> Fastify API
                                                                  |
                                                                  +--> model provider
```

Server 是可选增强层，只负责不能安全放进浏览器的能力，例如持有模型凭据和代理流式模型调用。浏览器包不得包含模型 API Key。

## 包职责

- `domain`：不依赖 UI 或存储实现的学习领域类型。
- `question-schema`：题目格式和来源元数据的运行时验证，是内容进入产品的门禁。
- `tutor-core`：Tutor 模式和 provider 流式契约；Phase 0 仅定义边界。
- `web`：页面、PWA、Dexie 适配器和离线交互。
- `server`：Fastify 入口和未来的服务端模型适配器。

## 关键数据流

1. 内容先进入 `content/original` 或由 importer 输出到 `content/quarantine`。
2. 题目通过 schema 校验和人工审核后，才可进入发布 manifest；Web 只加载 `reviewed` 内容。
3. Web 将作答、收藏和复习状态独立写入 IndexedDB v2；内容升级不覆盖学习记录。
4. 导入操作先完成大小限制、JSON 解析和 Zod 校验，再在单一事务中替换学习数据。
5. Tutor 请求只能在用户提交选择后构造；标准答案由领域层保持只读，模型响应不能回写答案字段。

离线 PWA 必须把题库正文和答案一起作为静态资源发布，因此答案不被视为客户端秘密。产品保证的是提交前不在界面 DOM 或 Tutor 请求中暴露答案。
