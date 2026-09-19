import { describe, expect, it } from 'vitest';

import { importLegacyJson } from './legacy-json';
import { imageMediaFromSource } from './media';
import { buildProvenanceReport } from './report';
import { approveManifest } from './review';
import { questionSchema } from '@agentprep/question-schema';

const legacy = [
  {
    id: 'q-1',
    question: 'Which boundary owns side effects?',
    options: ['Model', 'Executor'],
    answer: 'B',
    explanation: 'The executor validates and performs effects.',
  },
];

const importOptions = {
  chapter: 'runtime',
  source: 'https://example.test/repository',
  sourceVersion: 'abc123',
  license: 'CC-BY-4.0',
  manifestId: 'example-import',
  generatedAt: '2026-09-19T10:00:00.000Z',
  importance: 4 as const,
  subject: 'agent' as const,
};

const syntheticImageFixture = {
  question: {
    id: 'q-image',
    question: 'Which frame is transmitted first?',
    options: ['Frame A', 'Frame B'],
    answer: 'A',
  },
  image: {
    source: 'synthetic',
    sourceImagePath: 'fixtures\\images\\network-frames.svg',
    alt: 'Two network frames crossing a link',
  },
};

describe('legacy importer', () => {
  it('converts licensed input into unverified quarantine content', () => {
    const manifest = importLegacyJson(legacy, importOptions);
    expect(manifest.questions[0]).toMatchObject({
      id: 'imported-q-1',
      type: 'single_choice',
      correctChoiceId: 'choice-2',
      subject: 'agent',
      chapter: 'runtime',
      importance: 4,
      provenance: {
        source: 'https://example.test/repository#q-1',
        sourceVersion: 'abc123',
        license: 'CC-BY-4.0',
        reviewStatus: 'unverified',
      },
    });
    expect(manifest.questions[0]?.provenance.transform).toContain('input-sha256:');
  });

  it('refuses unclear redistribution licenses', () => {
    expect(() => importLegacyJson(legacy, { ...importOptions, license: 'unknown' })).toThrow(
      'concrete redistribution license',
    );
  });

  it('normalizes a synthetic source image into Question.media without changing legacy input', () => {
    const manifest = importLegacyJson([syntheticImageFixture.question], importOptions);
    const media = imageMediaFromSource(syntheticImageFixture.image);
    const question = questionSchema.parse({ ...manifest.questions[0], media: [media] });

    expect(question.media).toEqual([
      {
        type: 'image',
        src: '/question-assets/synthetic/network-frames.svg',
        alt: 'Two network frames crossing a link',
      },
    ]);
  });

  it('rejects absolute or traversing source image paths', () => {
    expect(() =>
      imageMediaFromSource({
        ...syntheticImageFixture.image,
        sourceImagePath: 'C:\\images\\network-frames.svg',
      }),
    ).toThrow('relative path');
    expect(() =>
      imageMediaFromSource({
        ...syntheticImageFixture.image,
        sourceImagePath: '../network-frames.svg',
      }),
    ).toThrow('traversal');
  });
});

describe('manual review gate', () => {
  it('records reviewer evidence while promoting external content', () => {
    const quarantined = importLegacyJson(legacy, importOptions);
    const reviewed = approveManifest(quarantined, {
      reviewer: 'reviewer@example.test',
      reviewedAt: '2026-09-19T11:00:00.000Z',
      licenseEvidence: 'https://example.test/license',
      contentVersion: '1.0.0',
    });
    expect(reviewed.review).toMatchObject({ reviewer: 'reviewer@example.test' });
    expect(reviewed.questions[0]?.provenance.reviewStatus).toBe('reviewed');

    const report = buildProvenanceReport([
      { file: 'content/manifests/example.json', text: JSON.stringify(reviewed) },
    ]);
    expect(report).toContain('Reviewed questions: 1');
    expect(report).toContain('https://example.test/repository#q-1');
    expect(report).toContain('CC-BY-4.0');
  });

  it('never promotes AI-generated questions', () => {
    const quarantined = importLegacyJson(legacy, importOptions);
    const aiManifest = {
      ...quarantined,
      questions: quarantined.questions.map((question) => ({
        ...question,
        provenance: { ...question.provenance, kind: 'ai_generated' as const },
      })),
    };
    expect(() =>
      approveManifest(aiManifest, {
        reviewer: 'reviewer',
        reviewedAt: '2026-09-19T11:00:00.000Z',
        licenseEvidence: 'internal generation log',
        contentVersion: '1.0.0',
      }),
    ).toThrow('cannot be promoted');
  });
});
