import { describe, expect, it } from 'vitest';

import {
  multipleChoiceQuestionSchema,
  oralQuestionSchema,
  publishedQuestionManifestSchema,
  questionMediaSchema,
  singleChoiceQuestionSchema,
  trueFalseQuestionSchema,
} from './index';

const reviewedProvenance = {
  kind: 'original' as const,
  source: 'AgentPrep editorial',
  sourceVersion: '2026-09-19',
  license: 'CC-BY-4.0',
  transform: 'authored-directly; editorial-review-v2',
  reviewStatus: 'reviewed' as const,
};

const baseQuestion = {
  id: 'agent-loop-001',
  version: '2.0.0',
  prompt: 'Which boundary owns side effects?',
  subject: 'agent' as const,
  chapter: 'runtime',
  knowledgePoints: ['tool-calling'],
  difficulty: 'foundation' as const,
  importance: 5 as const,
  provenance: reviewedProvenance,
};

const choices = [
  { id: 'a', text: 'Model' },
  { id: 'b', text: 'Controlled executor' },
  { id: 'c', text: 'Browser' },
];

const singleChoiceQuestion = {
  ...baseQuestion,
  type: 'single_choice' as const,
  choices,
  correctChoiceId: 'b',
  explanation: 'The executor validates and performs effects.',
};

const multipleChoiceQuestion = {
  ...baseQuestion,
  id: 'agent-guardrails-001',
  type: 'multiple_choice' as const,
  choices,
  correctChoiceIds: ['a', 'b'],
  explanation: 'Both layers contribute.',
};

const imageMedia = {
  type: 'image' as const,
  src: '/question-assets/synthetic/network-frames.svg',
  alt: 'Two network frames crossing a link',
};

function manifestWith(questions: unknown[]) {
  return {
    schemaVersion: 2,
    manifestId: 'schema-tests',
    contentVersion: '2.0.0',
    generatedAt: '2026-09-19T00:00:00.000Z',
    questions,
  };
}

describe('Question Schema v2', () => {
  it('accepts questions without media or with an empty media list', () => {
    expect(singleChoiceQuestionSchema.parse(singleChoiceQuestion).media).toBeUndefined();
    expect(singleChoiceQuestionSchema.parse({ ...singleChoiceQuestion, media: [] }).media).toEqual(
      [],
    );
  });

  it('accepts one or multiple image media items', () => {
    expect(
      singleChoiceQuestionSchema.parse({ ...singleChoiceQuestion, media: [imageMedia] }).media,
    ).toEqual([imageMedia]);
    expect(
      singleChoiceQuestionSchema.parse({
        ...singleChoiceQuestion,
        media: [
          imageMedia,
          {
            ...imageMedia,
            src: '/question-assets/synthetic/network-queue.svg',
            alt: 'Packets waiting in a queue',
          },
        ],
      }).media,
    ).toHaveLength(2);
  });

  it('rejects empty media fields and non-site asset paths', () => {
    expect(questionMediaSchema.safeParse({ ...imageMedia, alt: ' ' }).success).toBe(false);
    expect(questionMediaSchema.safeParse({ ...imageMedia, src: '' }).success).toBe(false);
    expect(
      questionMediaSchema.safeParse({ ...imageMedia, src: 'C:\\images\\frame.png' }).success,
    ).toBe(false);
  });

  it('validates exactly one known answer for a single-choice question', () => {
    expect(singleChoiceQuestionSchema.parse(singleChoiceQuestion).correctChoiceId).toBe('b');
    expect(
      singleChoiceQuestionSchema.safeParse({ ...singleChoiceQuestion, correctChoiceId: 'missing' })
        .success,
    ).toBe(false);
  });

  it('validates multiple distinct known answers for a multiple-choice question', () => {
    expect(multipleChoiceQuestionSchema.parse(multipleChoiceQuestion).correctChoiceIds).toEqual([
      'a',
      'b',
    ]);
    expect(
      multipleChoiceQuestionSchema.safeParse({
        ...multipleChoiceQuestion,
        correctChoiceIds: ['a'],
      }).success,
    ).toBe(false);
    expect(
      multipleChoiceQuestionSchema.safeParse({
        ...multipleChoiceQuestion,
        correctChoiceIds: ['a', 'missing'],
      }).success,
    ).toBe(false);
  });

  it('uses a boolean answer for true/false questions', () => {
    const question = trueFalseQuestionSchema.parse({
      ...baseQuestion,
      id: 'temperature-001',
      type: 'true_false',
      answer: false,
      explanation: 'Sampling can still vary across systems.',
    });
    expect(question.answer).toBe(false);
    expect(question).not.toHaveProperty('choices');
  });

  it('models oral questions without choice answer fields', () => {
    const question = oralQuestionSchema.parse({
      ...baseQuestion,
      id: 'agent-loop-oral-001',
      type: 'oral',
      referenceAnswer: 'An agent alternates model decisions and controlled tool execution.',
      keyPoints: ['model decision', 'controlled executor'],
      followUps: [],
    });
    expect(question.keyPoints).toHaveLength(2);
    expect(question.followUps).toEqual([]);
    expect(question).not.toHaveProperty('choices');
    expect(question).not.toHaveProperty('correctChoiceIds');
  });

  it('rejects duplicate question ids in a published manifest', () => {
    const result = publishedQuestionManifestSchema.safeParse(
      manifestWith([singleChoiceQuestion, { ...singleChoiceQuestion }]),
    );
    expect(result.success).toBe(false);
  });

  it('validates a published manifest containing prompt media', () => {
    const result = publishedQuestionManifestSchema.safeParse(
      manifestWith([{ ...singleChoiceQuestion, media: [imageMedia] }]),
    );
    expect(result.success).toBe(true);
  });

  it('rejects unreviewed content from a published manifest', () => {
    const result = publishedQuestionManifestSchema.safeParse(
      manifestWith([
        {
          ...singleChoiceQuestion,
          provenance: { ...reviewedProvenance, reviewStatus: 'unverified' },
        },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a chapter outside the canonical taxonomy from published content', () => {
    const result = publishedQuestionManifestSchema.safeParse(
      manifestWith([{ ...singleChoiceQuestion, chapter: 'unknown-chapter' }]),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ['questions', 0, 'chapter'] }),
      );
    }
  });

  it('does not allow AI-generated content to arrive pre-reviewed', () => {
    const result = singleChoiceQuestionSchema.safeParse({
      ...singleChoiceQuestion,
      provenance: {
        ...reviewedProvenance,
        kind: 'ai_generated',
        reviewStatus: 'reviewed',
      },
    });
    expect(result.success).toBe(false);
  });
});
