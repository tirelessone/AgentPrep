import { describe, expect, it, vi } from 'vitest';

import originalManifest from '../../../content/manifests/original-v2.json';

import {
  createQuestionContent,
  loadQuestionContent,
  mergePublishedManifests,
  publishedManifestUrls,
  toQuestionPrompt,
} from './content';

const originalContent = createQuestionContent(originalManifest);
const externalManifest = {
  schemaVersion: 2 as const,
  manifestId: 'synthetic-network',
  contentVersion: '1.0.0',
  generatedAt: '2026-09-20T00:00:00.000Z',
  questions: [
    {
      ...originalManifest.questions[0],
      id: 'synthetic-network-001',
      subject: 'computer_network',
      chapter: 'physical_layer',
      knowledgePoints: ['physical_layer'],
    },
  ],
};

describe('published content', () => {
  it('loads a reviewed original v2 manifest with every supported question type', () => {
    expect(originalContent.manifest.schemaVersion).toBe(2);
    expect(originalContent.manifest.questions).toHaveLength(8);
    expect(new Set(originalContent.manifest.questions.map((item) => item.type))).toEqual(
      new Set(['single_choice', 'multiple_choice', 'true_false', 'oral']),
    );
  });

  it('merges independently validated manifests in deterministic order', () => {
    const merged = mergePublishedManifests([originalManifest, externalManifest]);
    expect(merged.questions).toHaveLength(9);
    expect(merged.questions[0]?.id).toBe('agent-loop-001');
    expect(merged.questions.at(-1)?.id).toBe('synthetic-network-001');
  });

  it('rejects duplicate ids instead of allowing later manifests to overwrite', () => {
    expect(() => mergePublishedManifests([originalManifest, originalManifest])).toThrow(
      'Duplicate question id: agent-loop-001',
    );
  });

  it('loads both static PWA manifests before creating the question repository', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes('408-network') ? externalManifest : originalManifest;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const content = await loadQuestionContent(fetcher);
    expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      ...publishedManifestUrls,
    ]);
    expect(content.questionPrompts).toHaveLength(9);
  });

  it('does not expose answer or explanation fields in prompt projections', () => {
    originalContent.questionPrompts.forEach((prompt) => {
      expect(prompt).not.toHaveProperty('correctChoiceId');
      expect(prompt).not.toHaveProperty('correctChoiceIds');
      expect(prompt).not.toHaveProperty('answer');
      expect(prompt).not.toHaveProperty('explanation');
      expect(prompt).not.toHaveProperty('referenceAnswer');
      expect(prompt).not.toHaveProperty('keyPoints');
      expect(prompt).not.toHaveProperty('followUps');
    });
  });

  it('preserves media in the Question to QuestionPrompt projection', () => {
    const source = originalContent.manifest.questions[0]!;
    const media = [
      {
        type: 'image' as const,
        src: '/question-assets/synthetic/network-frames.svg',
        alt: 'Two network frames crossing a link',
      },
    ];
    expect(toQuestionPrompt({ ...source, media })).toMatchObject({ media });
  });

  it('reveals answers only through the type-specific reveal projection', () => {
    expect(originalContent.revealQuestion('agent-loop-001')).toMatchObject({
      type: 'single_choice',
      correctChoiceId: 'b',
    });
    expect(originalContent.revealQuestion('rag-grounding-001')).toMatchObject({
      type: 'multiple_choice',
      correctChoiceIds: ['a', 'c', 'e'],
    });
  });

  it('freezes verified source questions so UI and Tutor output cannot mutate answers', () => {
    const single = originalContent.manifest.questions[0]!;
    const multiple = originalContent.manifest.questions.find(
      (item) => item.type === 'multiple_choice',
    )!;
    expect(Object.isFrozen(single)).toBe(true);
    expect(Object.isFrozen(multiple)).toBe(true);
    if (multiple.type === 'multiple_choice') {
      expect(Object.isFrozen(multiple.correctChoiceIds)).toBe(true);
    }
  });
});
