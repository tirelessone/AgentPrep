import { describe, expect, it } from 'vitest';

import { multipleChoiceQuestionSchema } from './index';

const question = {
  id: 'original-agent-001',
  version: '1.0.0',
  type: 'multiple_choice' as const,
  prompt: 'Which boundary protects a provider API key?',
  choices: [
    { id: 'a', text: 'Browser bundle' },
    { id: 'b', text: 'Server environment' },
  ],
  correctChoiceIds: ['b'],
  explanation: 'Secrets remain on the server.',
  provenance: {
    kind: 'original' as const,
    source: 'agentprep',
    sourceVersion: '1.0.0',
    license: 'project-license',
    transform: 'authored-directly',
    reviewStatus: 'reviewed' as const,
  },
};

describe('multipleChoiceQuestionSchema', () => {
  it('accepts a question with complete provenance', () => {
    expect(multipleChoiceQuestionSchema.parse(question).id).toBe(question.id);
  });

  it('does not allow generated content to arrive pre-verified', () => {
    const result = multipleChoiceQuestionSchema.safeParse({
      ...question,
      provenance: { ...question.provenance, kind: 'ai_generated', reviewStatus: 'reviewed' },
    });

    expect(result.success).toBe(false);
  });
});
