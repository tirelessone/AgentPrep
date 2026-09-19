# Deployment

AgentPrep 可以仅发布静态 PWA，也可以在同一站点挂载可选 Fastify Server。无论哪种方式，发布前都应从干净检出执行 `pnpm install --frozen-lockfile` 和 `pnpm check`。

## 静态 PWA

```bash
pnpm build
```

将 `apps/web/dist` 作为静态站点根目录发布，并满足：

- 使用 HTTPS；本机开发环境除外。
- 未命中的页面路径回退到 `index.html`。
- `sw.js` 与 `manifest.webmanifest` 使用可重新验证或短缓存策略。
- 带内容哈希的 `assets/*` 可以设置长期 immutable 缓存。
- 保留正确的 JavaScript、CSS、SVG 和 manifest MIME 类型。

纯静态部署时 Tutor 会显示安全降级消息；刷题和本地学习数据不受影响。

## 可选 Server

Server 需要 Node.js 22+。在部署环境中设置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 和 Tutor 资源预算，然后运行：

```bash
pnpm --filter @agentprep/server build
pnpm --filter @agentprep/server start
```

使用 `GET /health` 作为存活检查。不要把 `.env` 文件打入镜像或静态资源。

默认资源预算为：单次请求体 64 KiB、每个来源 IP 每分钟 20 次 Tutor 请求、单次模型输出最多 800 tokens。可以通过 `TUTOR_BODY_LIMIT_BYTES`、`TUTOR_RATE_LIMIT_MAX`、`TUTOR_RATE_LIMIT_WINDOW_MS` 和 `OPENAI_MAX_OUTPUT_TOKENS` 调整。无效或越界配置会回退到安全默认值；发布时仍应在可信反向代理处配置第二层限流和总成本告警。

## 同源反向代理

当前 Web 请求相对路径 `/api/tutor/stream`，生产环境应将 `/api/*` 反向代理到 Fastify，其余路径交给静态站点。代理必须：

- 关闭 SSE 响应缓冲和压缩聚合。
- 保留 `text/event-stream`，并允许连接至少持续 25 秒。
- 在客户端断开时及时关闭上游连接。
- 不记录 Authorization 请求头或环境变量。

当前 Server 没有账号或用户状态，可以独立重启；学习数据仍只存在浏览器 IndexedDB。该性质不代表已经实现云同步或分布式运行承诺。

## 发布与回滚

1. 运行完整 CI、内容报告校验、第三方声明校验和 180 KiB JavaScript gzip 预算。
2. 保存发布 commit 和 `content/PROVENANCE_REPORT.md`。
3. 先部署 Server 并检查 `/health`，再发布静态资源。
4. 回滚静态版本时不要清除用户站点数据；Dexie 迁移必须保持向前兼容。
5. 内容授权或答案错误需要撤回时，发布新的 manifest 版本并保留题目 ID 与撤回记录。
