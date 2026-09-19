import { describe, expect, it } from 'vitest';

import { importLegacyJson } from './legacy-json';
import { buildProvenanceReport } from './report';
import { approveManifest } from './review';

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
  source: 'https://example.test/repository',
  sourceVersion: 'abc123',
  license: 'CC-BY-4.0',
  manifestId: 'example-import',
  generatedAt: '2026-09-19T10:00:00.000Z',
};

describe('legacy importer', () => {
  it('converts licensed input into unverified quarantine content', () => {
    const manifest = importLegacyJson(legacy, importOptions);
    expect(manifest.questions[0]).toMatchObject({
      id: 'imported-q-1',
      correctChoiceIds: ['choice-2'],
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
