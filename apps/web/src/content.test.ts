import { describe, expect, it } from 'vitest';

import { questionManifest, questionPrompts, revealQuestion } from './content';

describe('published content', () => {
  it('loads a reviewed original v2 manifest with every supported question type', () => {
    expect(questionManifest.schemaVersion).toBe(2);
    expect(questionManifest.questions).toHaveLength(8);
    expect(new Set(questionManifest.questions.map((item) => item.type))).toEqual(
      new Set(['single_choice', 'multiple_choice', 'true_false', 'oral']),
    );
    expect(
      questionManifest.questions.every((item) => item.provenance.reviewStatus === 'reviewed'),
    ).toBe(true);
  });

  it('does not expose any answer or explanation fields in prompt projections', () => {
    expect(questionPrompts).toHaveLength(8);
    questionPrompts.forEach((prompt) => {
      expect(prompt).not.toHaveProperty('correctChoiceId');
      expect(prompt).not.toHaveProperty('correctChoiceIds');
      expect(prompt).not.toHaveProperty('answer');
      expect(prompt).not.toHaveProperty('explanation');
      expect(prompt).not.toHaveProperty('referenceAnswer');
      expect(prompt).not.toHaveProperty('keyPoints');
      expect(prompt).not.toHaveProperty('followUps');
    });
  });

  it('reveals answers only through the type-specific reveal projection', () => {
    expect(revealQuestion('agent-loop-001')).toMatchObject({
      type: 'single_choice',
      correctChoiceId: 'b',
    });
    expect(revealQuestion('rag-grounding-001')).toMatchObject({
      type: 'multiple_choice',
      correctChoiceIds: ['a', 'c', 'e'],
    });
    expect(revealQuestion('temperature-determinism-001')).toMatchObject({
      type: 'true_false',
      answer: false,
    });
    expect(revealQuestion('agent-loop-oral-001')).toMatchObject({ type: 'oral' });
  });

  it('freezes verified source questions so UI and Tutor output cannot mutate answers', () => {
    const single = questionManifest.questions[0]!;
    const multiple = questionManifest.questions.find((item) => item.type === 'multiple_choice')!;
    expect(Object.isFrozen(single)).toBe(true);
    expect(Object.isFrozen(multiple)).toBe(true);
    if (multiple.type === 'multiple_choice') {
      expect(Object.isFrozen(multiple.correctChoiceIds)).toBe(true);
    }
  });
});
