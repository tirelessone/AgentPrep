# Windows Desktop

## 架构

AgentPrep Desktop 使用 Tauri 2 提供普通 Windows 窗口和 NSIS 安装包，继续复用 `apps/web` 内的 React/Vite UI。Rust 只启动 native shell；题库、领域逻辑、Dexie 数据与 Supabase adapter 仍在 TypeScript 层。

```text
Tauri 2 / WebView2
        |
React + Vite desktop build
   |                 |
IndexedDB         Supabase
local-first       optional sync
```

生产应用加载随包分发的 `apps/web/dist`，不会启动 Node、Vite、浏览器或 localhost。Desktop mode 使用相对 asset base，`content/*.json` 与 `question-assets/**` 都从 packaged frontend 解析；PWA service worker 和安装按钮只保留在普通 Web build。

## 开发环境

Windows 构建机需要：

- Node.js 22 与 pnpm 11.19
- Rust stable（MSVC target）
- Visual Studio 2022 C++ Build Tools，包含 Desktop development with C++ 与 Windows SDK
- Microsoft Edge WebView2 Runtime

开发窗口：

```bash
pnpm desktop:dev
```

Tauri 会自动以 desktop mode 启动 Vite，再打开 native window；不需要单独启动 `apps/server`。

## 检查与构建

```bash
pnpm desktop:check:frontend
pnpm desktop:verify
pnpm desktop:check
pnpm desktop:build
```

`desktop:verify` 对比 source/dist 题库与题图哈希，确认 Desktop 输出没有 service worker/PWA runtime 或禁止的凭据模式，并记录 JavaScript gzip 大小。`desktop:check` 依次构建、执行该验证器，再对 `apps/web/src-tauri/Cargo.toml` 运行 `cargo check`。`desktop:build` 生成 x64 NSIS setup，默认输出：

```text
apps/web/src-tauri/target/release/bundle/nsis/AgentPrep_0.1.0_x64-setup.exe
```

发布前必须在实际安装后的应用中验证开始菜单启动、529 道题与图片、作答/收藏/错题/复习、关闭重开持久化、断网冷启动、Supabase 登录同步和卸载。未完成这些步骤时，不得把代码构建等同于可日常使用。

## 本地数据与迁移

Desktop v1 继续使用 WebView2 IndexedDB。Guest 数据库为 `agentprep`，登录用户数据库为 `agentprep-user-<user-id>`。本地写入先完成，云端同步失败不会回滚学习操作。

Chrome localhost/PWA 与 Tauri 使用不同 storage origin，本地数据不会自动迁移：

1. 在浏览器版打开“数据”，导出 JSON。
2. 在 Desktop 打开“数据”，导入该 JSON。

若已有 Supabase 数据，也可在 Desktop 登录同一账号并执行同步。卸载是否保留 WebView2 数据取决于安装器和系统实际行为，发布前应实测并记录，不能依赖其作为备份策略。

## Supabase

`VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY` 在 build time 注入安装包；没有这两个值时，同一代码自动进入 Local-only mode。它们是浏览器公开配置，不得替换为 service role key、数据库密码或任何模型 API Key。

Web signup 继续使用 `window.location.origin` 作为邮件 redirect。Desktop signup 不发送 Tauri custom origin；Confirm Email 开启时，用户在外部邮箱完成确认后返回应用手动登录。本阶段不实现 deep link 或 OAuth callback。

默认 CSP 只允许 packaged assets、Tauri IPC 和 `*.supabase.co` 的 HTTPS/WSS 连接。若使用自托管或自定义 Supabase 域名，应在构建前把该明确域名加入 CSP，而不是改成 `connect-src *`。

## 已知限制

- Desktop v1 明确禁用 AI Tutor，包括 `tauri dev`。
- Backup/Restore 优先沿用 WebView2 的下载与 file input；只有 packaged smoke test 证明不可用时才加入最小化 native dialog/fs adapter。
- 安装包未签名，可能触发 SmartScreen Unknown publisher。
- 无 auto update、sidecar、系统托盘、全局热键、后台服务或自启动。
- 当前只支持 Windows；没有完成 macOS 或 Linux 构建。
