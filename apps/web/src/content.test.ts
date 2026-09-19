import { describe, expect, it } from 'vitest';

import { questionManifest, questionPrompts } from './content';

describe('published content', () => {
  it('loads a reviewed original manifest', () => {
    expect(questionManifest.schemaVersion).toBe(1);
    expect(questionManifest.questions).toHaveLength(5);
    expect(
      questionManifest.questions.every((item) => item.provenance.reviewStatus === 'reviewed'),
    ).toBe(true);
  });

  it('does not expose answers in prompt projections', () => {
    expect(questionPrompts).toHaveLength(5);
    expect(questionPrompts[0]).not.toHaveProperty('correctChoiceIds');
    expect(questionPrompts[0]).not.toHaveProperty('explanation');
  });

  it('freezes verified source questions so Tutor output cannot mutate answers', () => {
    const question = questionManifest.questions[0]!;
    expect(Object.isFrozen(question)).toBe(true);
    expect(Object.isFrozen(question.correctChoiceIds)).toBe(true);
  });
});
