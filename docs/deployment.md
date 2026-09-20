# Production Deployment

AgentPrep 的生产目标是 Vercel 静态 PWA + Supabase Auth/Postgres。Fastify AI Tutor 不属于本阶段公网部署；生产 Web 会明确提示 Tutor 未启用。没有 Supabase 配置时，同一构建会自动进入 Guest Local-only Mode。

## 1. 本地发布检查

环境要求为 Node.js 22+ 与仓库声明的 pnpm 版本。部署前从干净检出执行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

生产构建输出为 `apps/web/dist`。题库 manifest、题图、PWA service worker、192/512 图标和 Apple Touch Icon 都由 Web 构建发布。

## 2. 创建 Supabase 项目

1. 在 Supabase 创建一个项目，不需要额外 profile、question、review 或 chat 表。
2. 在 SQL Editor 执行 [account cloud sync migration](../supabase/migrations/202609200001_account_cloud_sync.sql)，或用已登录的 Supabase CLI 应用同一 migration。
3. 确认已创建 `study_attempts`、`favorite_states`、`user_settings`，且三张表均启用 Row Level Security。
4. 在 Project Settings 获取 Project URL 和 publishable key。旧项目只有 anon public key 时也可作为 browser public key 使用。

绝不能把 service role key、数据库密码或用户密码放进 `VITE_*`、源码、Git 或 Vercel Web 构建环境。浏览器只有 public/publishable key；数据隔离依赖 SQL migration 中的 RLS。

## 3. Supabase Auth URL

在 Supabase Dashboard 的 **Authentication → URL Configuration** 设置：

- Site URL：正式 Vercel 自定义域名或 production URL。
- Allowed Redirect URLs：`http://localhost:5173/**`。
- Allowed Redirect URLs：`https://<production-domain>/**`。

不要硬编码临时 Preview URL。若启用 email confirmation，用户注册后会看到检查邮箱提示，验证链接会回到允许的 AgentPrep URL。

## 4. Vercel 部署

1. 把仓库推送到 GitHub，并在 Vercel Import Project 中选择该仓库。
2. Root Directory 保持仓库根目录；`vercel.json` 已固定 pnpm workspace 安装、Web build 和 `apps/web/dist` 输出。
3. 在 Production Environment 设置：

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<public-or-publishable-key>
```

4. 触发 production deployment。Vercel HTTPS 满足 PWA 安装要求；`sw.js` 与 manifest 使用重新验证缓存，带 hash 的 `assets/*` 使用 immutable 缓存。

本阶段不把 Fastify Server 部署到 Vercel，也不要设置 OpenAI Key。若本机需要 Tutor，继续运行 `pnpm dev`；生产静态站点只提供学习与同步能力。

## 5. RLS 人工验收

真实 Supabase 项目配置后，创建测试账号 A 与 B，并使用 browser public key 验收：

1. A 登录后写入一条 attempt/favorite/setting，只能查询到 A 的 rows。
2. B 登录后只能查询和修改 B 的 rows。
3. A 尝试插入 `user_id = B` 的 row，必须被 RLS 拒绝。
4. A 尝试 update/delete B 的 row，必须影响 0 行或返回 RLS 错误。
5. 删除测试账号时，相关 rows 应因 `ON DELETE CASCADE` 被删除。

不能用“UI 没显示”替代这项验证。SQL policy 对 SELECT/INSERT/UPDATE/DELETE 分别使用 `auth.uid() = user_id` 的 `using` / `with check`。

## 6. Production smoke test

在 390×844 手机视口和至少两个独立浏览器/设备执行：

1. Guest 不登录即可刷题、收藏、复习、导入导出并离线重开。
2. Guest 有记录时登录 A，只在点击“合并到我的账号”后写入 A 的缓存与 cloud；Guest 数据不删除。
3. A 在设备 1 作答并收藏，设备 2 登录 A 后出现相同 attempts、错题、今日复习和收藏。
4. 设备 2 离线作答，关闭并重开仍保留；恢复联网后自动同步，设备 1 focus 后得到新记录。
5. A 退出、B 登录后看不到 A 的本地或云端数据；A 再登录可恢复。
6. Android Chrome/Edge 可安装到主屏幕；离线 reload 仍能加载题库和应用壳。

电脑关机不会影响 Vercel/Supabase 托管的生产应用。首次真实发布还应记录 production URL、deployment commit、Supabase migration 版本和以上 smoke test 结果。

## 7. 安全与数据边界

- IndexedDB 是 UI 的即时读写源；cloud 失败不回滚本地操作。
- Supabase Auth 管理 session；AgentPrep 不保存密码、不实现密码 hash。
- 账号数据库使用 `agentprep-user-<user-id>`，Guest 使用 `agentprep`。
- cloud rows 写入 IndexedDB 前通过 Zod 验证；客户端构造 `user_id`，不接受业务调用者传入。
- Attempts append-only；Favorites/Settings 使用 updatedAt LWW；Reviews 从 merged attempts 重建。
- `device:*` 设置、认证 token、API Key、题库和 reviews 不进入 `user_settings`。
- Backup 不包含 Supabase credentials；Backup v2 继续接受 v1。

## 8. 回滚

回滚静态站点时不要清除 Vercel/Supabase 数据或用户浏览器站点数据。Dexie 与 Backup migration 必须保持向前兼容。涉及 schema 的回滚应新增 Supabase migration，不直接编辑已应用 migration。
