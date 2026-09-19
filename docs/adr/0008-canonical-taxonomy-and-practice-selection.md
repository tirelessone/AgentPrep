# ADR 0008: Canonical taxonomy 与批量专项练习选择

- 状态：Accepted
- 日期：2026-09-19

## 背景

Question Domain v2 已提供 subject、chapter 与 knowledgePoints，但 subject 类型曾在多个 package 重复维护，chapter 也只是未经约束的字符串。继续扩充内容会造成章节命名漂移，UI 直接显示内部 ID，同时难以提供稳定的专项刷题入口。

## 决策

新增无业务上游依赖的 `@agentprep/taxonomy` package，集中维护 subject、chapter、排序和中文展示名称。依赖方向固定为：

```text
taxonomy <- question-schema <- domain
```

`question-schema` 从 taxonomy 复用 subject、difficulty 和 importance schema，并在 published manifest 门禁验证 subject/chapter 组合。基础 question schema 的 chapter 继续是 string，使隔离区可以承接尚待映射的内容；knowledgePoints 继续是开放的 string array。

`domain` 通过 type-only import 复用 question-schema 导出的 Subject、Difficulty 和 Importance 类型，不再手写同一套 union。Web 通过 taxonomy 的展示函数渲染中文名称，不在组件内维护散落映射。

专项练习先按 subject/chapter 对静态 QuestionPrompt 数组做线性过滤，再使用候选 questionId 通过 `anyOf` 执行一次批量 IndexedDB 查询：未做题读取 attempts 的 questionId 唯一键，错题读取候选范围内的 attempts 并构建最新记录 Map，收藏读取候选范围内的主键。得到的 ID Set 与候选题做线性求交，随后固定本次 Session 队列。

## 结果

发布内容不能使用未知或跨学科章节，界面只展示中文名称。筛选成本为题目量与相关学习记录量的线性复杂度，没有逐题数据库查询。错题模式仍需一次扫描作答记录；如果单设备记录增长到远高于常规个人使用规模，可在后续单独维护 latest-attempt 投影，但本阶段不引入额外表或基础设施。

本决策不导入外部题库，不增加 AI、mastery、adaptive learning、Server 或 CI 能力。
