import { createHash } from 'node:crypto';

import {
  publishedQuestionManifestSchema,
  type Question,
  type QuestionManifest,
} from '@agentprep/question-schema';

import { mapNetworkChapter, networkChapterMappings, type NetworkChapter } from './chapters.js';
import { extractMarkdownImages, materialize408PromptMedia } from './media.js';
import { upstream408FileSchema, upstream408QuestionSchema } from './schema.js';

export const SOURCE_REPOSITORY = 'https://github.com/lij768423-svg/408-';
export const EXPECTED_408_INPUT_SHA256 =
  '5baf510df78f660458daefebdffa3503acc5f9a7c703d4f5282576e5589ef2fd';

export type SkipReason =
  | 'duplicate_upstream_id'
  | 'empty_prompt'
  | 'explanation_media_required'
  | 'hidden_or_bad'
  | 'invalid_answer'
  | 'invalid_options'
  | 'invalid_upstream_record'
  | 'missing_prompt_image'
  | 'unknown_chapter'
  | 'unsupported_or_unreliable_type';

export interface Skipped408Question {
  id: string;
  reasons: readonly SkipReason[];
}

export interface Import408Report {
  sourceVersion: string;
  inputSha256: string;
  sourceTotal: number;
  networkTotal: number;
  imported: number;
  skipped: number;
  singleChoiceImported: number;
  multipleChoiceSkipped: number;
  chapterCounts: Record<NetworkChapter, number>;
  invalidAnswerCount: number;
  invalidOptionsCount: number;
  unknownChapterCount: number;
  missingPromptImageCount: number;
  unsupportedExplanationImageCount: number;
  hiddenOrBadCount: number;
  invalidUpstreamCount: number;
  explanationMediaRequiredCount: number;
  imageQuestionCount: number;
  copiedImageCount: number;
  skippedIds: readonly Skipped408Question[];
  promptImageQuestionIds: readonly string[];
  unsupportedExplanationImageIds: readonly string[];
}

export interface Import408Result {
  manifest: QuestionManifest;
  report: Import408Report;
}

function isNetworkRecord(value: unknown) {
  return (
    typeof value === 'object' && value !== null && 'book' in value && value.book === '计算机网络'
  );
}

function validOptions(options: Record<string, string>) {
  const entries = Object.entries(options);
  return (
    entries.length >= 2 &&
    entries.every(([key, text]) => /^[A-Z]$/.test(key) && text.trim().length > 0)
  );
}

function chapterCountRecord() {
  return Object.fromEntries(networkChapterMappings.map(({ chapter }) => [chapter, 0])) as Record<
    NetworkChapter,
    number
  >;
}

export async function import408Network({
  inputText,
  sourceRoot,
  assetOutput,
  sourceVersion,
  expectedInputSha256 = EXPECTED_408_INPUT_SHA256,
}: {
  inputText: string;
  sourceRoot: string;
  assetOutput: string;
  sourceVersion: string;
  expectedInputSha256?: string | undefined;
}): Promise<Import408Result> {
  const inputSha256 = createHash('sha256').update(inputText).digest('hex');
  if (inputSha256 !== expectedInputSha256) {
    throw new Error(`Unexpected data.json SHA-256: ${inputSha256}`);
  }

  const sourceFile = upstream408FileSchema.parse(JSON.parse(inputText) as unknown);
  const generatedAt = new Date(sourceFile.generated_at).toISOString();
  const networkRecords = sourceFile.questions.filter(isNetworkRecord);
  const questions: Question[] = [];
  const skipped = new Map<string, Set<SkipReason>>();
  const chapterCounts = chapterCountRecord();
  const copiedAssets = new Set<string>();
  const promptImageQuestionIds: string[] = [];
  const unsupportedExplanationImageIds: string[] = [];
  const seenUpstreamIds = new Set<string>();
  let multipleChoiceSkipped = 0;
  let invalidAnswerCount = 0;
  let invalidOptionsCount = 0;
  let unknownChapterCount = 0;
  let missingPromptImageCount = 0;
  let hiddenOrBadCount = 0;
  let invalidUpstreamCount = 0;
  let explanationMediaRequiredCount = 0;

  function skip(id: string, reason: SkipReason) {
    const reasons = skipped.get(id) ?? new Set<SkipReason>();
    reasons.add(reason);
    skipped.set(id, reasons);
  }

  for (const [recordIndex, rawQuestion] of networkRecords.entries()) {
    const parsed = upstream408QuestionSchema.safeParse(rawQuestion);
    if (!parsed.success) {
      invalidUpstreamCount += 1;
      skip(`network-record-${recordIndex}`, 'invalid_upstream_record');
      continue;
    }
    const item = parsed.data;

    if (item.type === 'multiple_choice') {
      multipleChoiceSkipped += 1;
      skip(item.id, 'unsupported_or_unreliable_type');
    } else if (item.type !== 'single_choice') {
      skip(item.id, 'unsupported_or_unreliable_type');
    }
    if (item.hidden) {
      hiddenOrBadCount += 1;
      skip(item.id, 'hidden_or_bad');
    }
    if (skipped.has(item.id)) continue;

    if (seenUpstreamIds.has(item.id)) {
      skip(item.id, 'duplicate_upstream_id');
      continue;
    }
    seenUpstreamIds.add(item.id);

    if (!validOptions(item.options)) {
      invalidOptionsCount += 1;
      skip(item.id, 'invalid_options');
      continue;
    }
    if (item.answer.length !== 1 || !(item.answer[0]! in item.options)) {
      invalidAnswerCount += 1;
      skip(item.id, 'invalid_answer');
      continue;
    }

    const chapter = mapNetworkChapter(item.chapter, item.chapter_title);
    if (!chapter) {
      unknownChapterCount += 1;
      skip(item.id, 'unknown_chapter');
      continue;
    }

    const promptContent = extractMarkdownImages(item.question);
    if (!promptContent.text) {
      skip(item.id, 'empty_prompt');
      continue;
    }
    const explanationContent = extractMarkdownImages(item.explanation);
    if (explanationContent.references.length > 0 && !explanationContent.text) {
      explanationMediaRequiredCount += 1;
      skip(item.id, 'explanation_media_required');
      continue;
    }
    const explanation = explanationContent.text || '暂无题库解析。';

    let media: Awaited<ReturnType<typeof materialize408PromptMedia>> | undefined;
    if (promptContent.references.length > 0) {
      try {
        media = await materialize408PromptMedia({
          references: promptContent.references,
          sourceRoot,
          assetOutput,
        });
      } catch (error) {
        if (error instanceof Error && /ENOENT|cannot find/i.test(error.message)) {
          missingPromptImageCount += 1;
          skip(item.id, 'missing_prompt_image');
          continue;
        }
        throw error;
      }
      promptImageQuestionIds.push(item.id);
      media.assetNames.forEach((assetName) => copiedAssets.add(assetName));
    }
    if (explanationContent.references.length > 0) {
      unsupportedExplanationImageIds.push(item.id);
    }

    const choices = Object.entries(item.options)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, text]) => ({ id: id.toLowerCase(), text }));
    const question: Question = {
      id: `408-${item.id}`,
      version: '1.0.0',
      type: 'single_choice',
      prompt: promptContent.text,
      subject: 'computer_network',
      chapter,
      knowledgePoints: [chapter],
      difficulty: 'foundation',
      importance: 3,
      ...(media ? { media: media.media } : {}),
      choices,
      correctChoiceId: item.answer[0]!.toLowerCase(),
      explanation,
      provenance: {
        kind: 'licensed_external',
        source: `${SOURCE_REPOSITORY}@${sourceVersion}#${item.id}; source_file:${item.source_file}`,
        sourceVersion,
        license: 'ISC',
        transform: `agentprep-408-importer@1; input-sha256:${inputSha256}; original-id:${item.id}; canonical-chapter:${chapter}`,
        reviewStatus: 'reviewed',
      },
    };
    questions.push(question);
    chapterCounts[chapter] += 1;
  }

  const manifest = publishedQuestionManifestSchema.parse({
    schemaVersion: 2,
    manifestId: '408-computer-network',
    contentVersion: `408-network-${sourceVersion.slice(0, 12)}`,
    generatedAt,
    review: {
      reviewer: 'AgentPrep importer validation and sample review',
      reviewedAt: generatedAt,
      licenseEvidence: `${SOURCE_REPOSITORY}/blob/${sourceVersion}/LICENSE`,
    },
    questions,
  });
  const skippedIds = [...skipped.entries()]
    .map(([id, reasons]) => ({ id, reasons: [...reasons].sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    manifest,
    report: {
      sourceVersion,
      inputSha256,
      sourceTotal: sourceFile.questions.length,
      networkTotal: networkRecords.length,
      imported: questions.length,
      skipped: skippedIds.length,
      singleChoiceImported: questions.length,
      multipleChoiceSkipped,
      chapterCounts,
      invalidAnswerCount,
      invalidOptionsCount,
      unknownChapterCount,
      missingPromptImageCount,
      unsupportedExplanationImageCount: unsupportedExplanationImageIds.length,
      hiddenOrBadCount,
      invalidUpstreamCount,
      explanationMediaRequiredCount,
      imageQuestionCount: promptImageQuestionIds.length,
      copiedImageCount: copiedAssets.size,
      skippedIds,
      promptImageQuestionIds,
      unsupportedExplanationImageIds,
    },
  };
}
