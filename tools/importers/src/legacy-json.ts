import { createHash } from 'node:crypto';

import { questionManifestSchema, type QuestionManifest } from '@agentprep/question-schema';
import { z } from 'zod';

const legacyQuestionSchema = z.object({
  id: z.union([z.string().min(1), z.number().int()]),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  explanation: z.string().optional(),
  topics: z.array(z.string().min(1)).optional(),
  difficulty: z.enum(['foundation', 'intermediate', 'advanced']).optional(),
});

const legacyFileSchema = z.array(legacyQuestionSchema);

export interface LegacyImportOptions {
  source: string;
  sourceVersion: string;
  license: string;
  manifestId: string;
  generatedAt: string;
}

function resolveAnswer(answer: string | number, options: readonly string[]) {
  if (typeof answer === 'number') {
    if (answer >= options.length) throw new Error(`Answer index ${answer} is out of range.`);
    return answer;
  }
  const normalized = answer.trim();
  if (/^[A-Za-z]$/.test(normalized)) {
    const index = normalized.toUpperCase().charCodeAt(0) - 65;
    if (index < options.length) return index;
  }
  const byText = options.indexOf(normalized);
  if (byText >= 0) return byText;
  throw new Error(`Answer ${JSON.stringify(answer)} does not match an option.`);
}

export function importLegacyJson(input: unknown, options: LegacyImportOptions): QuestionManifest {
  if (/^(unknown|unlicensed|none)$/i.test(options.license.trim())) {
    throw new Error('A concrete redistribution license is required before import.');
  }
  const sourceQuestions = legacyFileSchema.parse(input);
  const sourceDigest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const questions = sourceQuestions.map((item) => {
    const answerIndex = resolveAnswer(item.answer, item.options);
    const id = `imported-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return {
      id,
      version: '1.0.0',
      type: 'multiple_choice' as const,
      prompt: item.question,
      topics: item.topics ?? ['imported'],
      difficulty: item.difficulty ?? ('foundation' as const),
      choices: item.options.map((text, index) => ({ id: `choice-${index + 1}`, text })),
      correctChoiceIds: [`choice-${answerIndex + 1}`],
      explanation: item.explanation?.trim() || '待人工补充解析。',
      provenance: {
        kind: 'licensed_external' as const,
        source: `${options.source}#${String(item.id)}`,
        sourceVersion: options.sourceVersion,
        license: options.license,
        transform: `agentprep-legacy-json@1; input-sha256:${sourceDigest}`,
        reviewStatus: 'unverified' as const,
      },
    };
  });

  return questionManifestSchema.parse({
    schemaVersion: 1,
    manifestId: options.manifestId,
    contentVersion: '0.1.0-quarantine',
    generatedAt: options.generatedAt,
    questions,
  });
}
