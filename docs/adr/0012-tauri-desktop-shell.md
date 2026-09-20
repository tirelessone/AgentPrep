# ADR 0012: Tauri 2 Windows desktop shell

- Status: Accepted
- Date: 2026-09-20

## Context

AgentPrep 的主要学习路径已经是 local-first PWA，但 Windows 用户仍需要通过浏览器或 localhost 进入。目标是提供可安装、可从开始菜单启动、断网可刷题的桌面应用，同时保留同一套 React/Vite 业务逻辑、IndexedDB 数据模型和可选 Supabase 同步。

## Decision

- 使用 Tauri 2 与系统 WebView2，在 `apps/web/src-tauri` 增加 Windows shell，不创建第二份前端。
- Web build 保留 PWA；Desktop build 使用明确的 Vite `desktop` mode、相对 asset base，并关闭 service worker 与 PWA 安装入口。
- Rust 只负责 shell 和 bundling。题库、领域逻辑、学习状态、同步与答案隔离继续由 TypeScript 实现。
- Desktop v1 继续使用 Dexie/IndexedDB，不迁移 SQLite、Tauri Store 或文件 JSON。
- Supabase 仍是可选增强。Desktop signup 不把 Tauri origin 用作邮件 redirect；不实现 deep link。
- Desktop dev 与 production 都禁用 AI Tutor，不打包 Fastify sidecar，也不向 WebView 注入 OpenAI API Key。
- 首个 bundle 使用 unsigned、per-user NSIS installer。不开启 updater、shell、filesystem 或其他 native plugin；当前前端不获得 Tauri command capability。
- 生产 CSP 允许本地 packaged assets、Tauri IPC 和 Supabase 官方域名的 HTTPS/WSS；开发 CSP 额外允许固定的 Vite loopback HTTP/WebSocket，不使用通配 `connect-src *`。

## Alternatives

Electron 可以复用 Web UI，但会同时分发 Chromium 与 Node runtime。AgentPrep 不需要 Node sidecar、复杂 native API 或自定义浏览器能力，因此其包体和安全面没有带来对应价值。

继续只提供 PWA 无法满足无需浏览器地址/localhost、从 Windows 开始菜单启动和交付标准 installer 的目标。重写为 .NET、Qt、Flutter 或 React Native 会复制已经稳定的业务层。

## Consequences

- Windows 构建机需要 Rust stable、MSVC C++ Build Tools 与 Windows SDK；用户机器需要 WebView2 Runtime。
- Desktop 与 Chrome/PWA 使用不同 storage origin，浏览器本地数据通过备份 JSON 或 Supabase 同账号同步迁移，不能声称自动继承。
- 同一套前端要同时通过 Web/PWA 与 Desktop frontend 回归检查。
- 自托管或自定义域名 Supabase 需要显式扩展 CSP allowlist。
- 未签名安装包可能出现 SmartScreen Unknown publisher；本阶段不通过自签名或购买证书掩盖该事实。
