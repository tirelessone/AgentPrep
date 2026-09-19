# AI Tutor

AI Tutor 是可选在线增强层。Server 未配置或网络中断时，刷题、错题、收藏、复习与备份仍可正常使用。

## 配置

仅在 `apps/server` 进程中设置：

- `OPENAI_API_KEY`：供应商密钥，必需
- `OPENAI_BASE_URL`：OpenAI-compatible API 根地址，默认 `https://api.openai.com/v1`
- `OPENAI_MODEL`：模型名，默认 `gpt-4.1-mini`

严禁把密钥放入 `VITE_*` 变量、浏览器存储或 Git。Server 无密钥时会返回稳定的 `PROVIDER_ERROR` SSE 事件，而不是阻止应用启动。

## 请求与事件

`POST /api/tutor/stream` 接受 `mode`、`message` 和可选的已提交题目上下文。当前 Web 只在用户提交选择后展示 Tutor，因此标准答案不会出现在提交前请求中。

响应使用 `text/event-stream`：

- `meta`：请求 ID 和模式
- `token`：增量文本
- `done`：正常结束
- `error`：`TIMEOUT` 或 `PROVIDER_ERROR` 的安全消息

浏览器和服务端都支持 AbortSignal。服务端默认 20 秒超时；断开客户端连接会中止 provider 流。模型输出仅作为临时辅导文本，不能写回冻结的发布题库。

## 六种模式

`zero_base`、`wrong_reason`、`interview_scope`、`socratic`、`similar_question`、`free_chat`。`similar_question` 生成的内容只用于即时练习，不进入发布 manifest，也不能标记为已验证。
