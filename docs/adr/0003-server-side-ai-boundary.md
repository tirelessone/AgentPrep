# ADR 0003：模型调用限定在可选服务端边界

- 状态：Accepted
- 日期：2026-09-19

## 背景

AI Tutor 需要流式响应，同时必须保护 API Key、标准答案和核心离线体验。

## 决策

浏览器只调用 Fastify 暴露的受控 SSE 接口；provider 凭据仅由 Server 环境变量读取。`tutor-core` 定义可取消的异步流契约，具体 provider 在后续阶段实现。提交选择题之前不得构造包含标准答案的 Tutor 请求；模型输出永远不能修改题目标准答案。

## 后果

无 Server 时 Tutor 不可用，但刷题和复习不受影响。后续必须测试取消、超时、断流、错误降级和 mock provider，不以真实模型作为 CI 依赖。
