# Content workflow

所有外部内容都必须经过“转换到隔离区 → 人工审核 → 发布 manifest → 重建溯源报告”四步。Importer 不复用来源项目的应用代码，也不能直接写入发布目录。

## 1. 转换到隔离区

当前 legacy importer 接受一个 JSON 数组，每项包含 `id`、`question`、`options`、`answer`，可选 `explanation`、`topics` 和 `difficulty`。数字答案按零起始下标解释，字符串答案可使用 A/B/C 标签或完整选项文本。该兼容入口只转换为 `single_choice`；多选、判断和口述题必须直接按 Question Schema v2 建模，避免根据旧数据猜测题型。

```bash
pnpm --filter @agentprep/importers import:legacy -- \
  --input /path/to/licensed-data.json \
  --output candidate.json \
  --source https://example.com/repository \
  --source-version COMMIT_SHA \
  --license CC-BY-4.0 \
  --subject agent \
  --chapter runtime \
  --importance 3 \
  --manifest-id candidate-bank
```

`--subject` 必须是 canonical taxonomy 定义的学科之一，`--chapter` 必须使用该学科下的 canonical chapter id，`--importance` 必须为 1–5。旧输入的 `topics` 会转换为 `knowledgePoints`。隔离区允许暂存非 canonical chapter，但人工审核发布时会被拒绝，直到映射完成。输出只能进入 `content/quarantine`，默认状态为 `unverified`。命令拒绝 `unknown`、`unlicensed` 等模糊许可证，并拒绝覆盖已有文件。

## 2. 人工审核

审核者需要逐题核对题意、选项、答案、解析、来源定位和再分发许可。确认后执行：

```bash
pnpm --filter @agentprep/importers review -- \
  --input candidate.json \
  --output candidate-v1.json \
  --reviewer REVIEWER_ID \
  --license-evidence https://example.com/license \
  --content-version 1.0.0
```

审核命令只从隔离区读取、只向 manifest 目录写入，并记录审核者与许可证证据。它会拒绝任何 `ai_generated` 内容，避免生成流程自动把 AI 题标记为已验证。

## 3. 重建与校验报告

```bash
pnpm content:report
pnpm content:verify
```

报告列出每个发布 manifest 的 SHA-256，以及逐题的来源、版本、许可证、转换方式和审核状态。CI 运行 `content:verify`，报告过期或 manifest 不满足发布 Schema 时会失败。

未取得清晰再分发授权时必须停止流程。功能参考不等于内容授权，改写或模型转述也不能消除原内容的权利边界。

## 4. 题目图片约定

Question Schema v2 的 `media` 只支持图片。Importer 必须把来源中的相对图片路径转换为稳定站内路径，并将文件放在：

```text
apps/web/public/question-assets/<source>/<file>
```

Question 中只保存 `/question-assets/<source>/<file>`，不得保存 Windows 绝对路径、来源仓库的本地路径或任意 HTML。`source` 使用小写 URL-safe slug；Importer 应为重名文件生成稳定且唯一的目标文件名，发生冲突时停止而不是覆盖。图片必须提供能表达题目所需信息的非空 `alt`。这些静态资源会进入 PWA 预缓存，因此离线练习不依赖图片来源站点。

当前 legacy importer 不推断或复制媒体。专用 importer 可以使用共享的 `imageMediaFromSource` helper 将经过校验的来源相对路径投影为 `Question.media`，但文件存在性、内容哈希、复制和重名检查仍由该专用 importer 负责。

## 5. 坏数据处理策略

Importer 遇到下列情况必须失败，或把整条记录连同原因写入隔离区；不得猜测修复：

- 答案数组包含重复项；
- 答案标识不存在于 `options`；
- 题型与答案结构不一致，例如单选题出现多个答案；
- 题目或解析依赖的图片缺失；
- 章节无法映射到该学科的 canonical taxonomy。

不得为某个外部题目 ID 添加硬编码修复。若来源存在系统性转换错误，应升级 importer 规则、记录转换版本并重新生成全部输出；若规则不能确定性证明正确，则保持隔离并交由人工审核。
