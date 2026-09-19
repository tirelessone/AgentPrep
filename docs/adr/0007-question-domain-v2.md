# ADR 0007: Question Domain v2 使用判别联合与 manifest v2

- 状态：Accepted
- 日期：2026-09-19

## 背景

Question Schema v1 将所有客观题都表示为 `multiple_choice`，无法从契约判断单选或多选，也不能自然表达判断题与口述题。题目分类只有松散的 topics，难以支持 Agent / LLM 岗位题库的章节化维护。与此同时，现有 IndexedDB 已保存基于稳定 `questionId` 的作答、收藏和复习记录，升级题库不能破坏这些本地数据。

## 决策

Question Schema v2 使用 `type` 作为判别字段，将题目定义为 `single_choice`、`multiple_choice`、`true_false` 和 `oral` 的 Zod discriminated union。

- 公共元数据包含 `subject`、`chapter`、`knowledgePoints`、`difficulty` 和 `importance`。
- 单选题使用唯一的 `correctChoiceId`；多选题使用至少两个 `correctChoiceIds`；判断题使用 boolean `answer`；口述题使用 `referenceAnswer`、`keyPoints` 和 `followUps`。
- Web 只接收不含标准答案的 `QuestionPrompt`。提交或主动查看参考答案后，才从本地发布 manifest 生成对应的 `QuestionReveal`。
- provenance 的来源类型与审核语义保持不变。发布 manifest 仍只接受 `reviewed` 内容，`ai_generated` 仍只能以 `unverified` 进入系统。
- 选择方案 B：直接将当前原创小样升级为 `original-v2.json`，不在运行时同时维护 v1/v2 两套发布 schema。原 5 道题保留 `id`，题目版本升级为 `2.0.0`，另加入覆盖四种题型所需的少量原创示例。

## 学习记录兼容

收藏、复习计划和错题队列继续以稳定 `questionId` 关联题目，因此不需要升级 Dexie 表结构。旧作答保留当时的 `questionVersion` 和 `selectedChoiceIds`；新作答在保留 `selectedChoiceIds` 的同时增加可选的判别式 `response`，用于保存判断题 boolean 和口述题自评。备份 schema 采用同样的可选字段，因此旧备份可继续导入，新备份也能完整往返。

旧 manifest 不再由应用加载。legacy importer 仍接受旧单选格式，但必须显式补充 subject、chapter 和 importance，并只转换为 `single_choice`；它不会猜测其他题型。

## 结果

UI 可以按题型选择 radio、checkbox、boolean 判断或口述自评，同时提交前不会获得答案字段。代价是后续内容作者必须明确题型和结构化分类，且若未来需要发布 v1 外部内容，必须先在 importer 或离线迁移工具中转换为 v2。

本决策不引入 mastery、adaptive learning、新 AI 能力或真实题库导入。
