import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StudyAttempt } from '@agentprep/domain';

import { questionPrompts } from '../../content';
import { AgentPrepDatabase } from '../../db';
import {
  filterQuestionsByTaxonomy,
  getAvailableSubjectSummaries,
  getChapterSummaries,
  selectPracticeQuestions,
} from './practice-selection';

let database: AgentPrepDatabase;

beforeEach(() => {
  database = new AgentPrepDatabase(`agentprep-selection-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await database.delete();
});

function attempt(questionId: string, attemptedAt: string, correct: boolean): StudyAttempt {
  return {
    id: crypto.randomUUID(),
    questionId,
    questionVersion: '2.1.0',
    attemptedAt,
    selectedChoiceIds: [],
    correct,
  };
}

describe('practice selection', () => {
  it('filters subjects and reports only subjects that currently contain questions', () => {
    expect(getAvailableSubjectSummaries(questionPrompts)).toEqual([
      expect.objectContaining({ id: 'llm', label: 'LLM', questionCount: 1 }),
      expect.objectContaining({ id: 'agent', label: 'Agent / RAG', questionCount: 7 }),
    ]);
    expect(filterQuestionsByTaxonomy(questionPrompts, { subject: 'llm' })).toHaveLength(1);
  });

  it('filters by canonical chapter and exposes chapter counts', () => {
    expect(
      filterQuestionsByTaxonomy(questionPrompts, { subject: 'agent', chapter: 'runtime' }),
    ).toHaveLength(4);
    expect(getChapterSummaries(questionPrompts, 'agent')).toContainEqual(
      expect.objectContaining({ id: 'runtime', label: '运行时', questionCount: 4 }),
    );
  });

  it('filters unattempted questions using one distinct indexed lookup', async () => {
    await database.attempts.add(attempt('agent-loop-001', '2026-09-19T10:00:00.000Z', true));
    const questions = await selectPracticeQuestions(database, questionPrompts, {
      subject: 'agent',
      mode: 'unattempted',
    });
    expect(questions).toHaveLength(6);
    expect(questions.map((question) => question.id)).not.toContain('agent-loop-001');
  });

  it('uses the latest attempt per question for wrong filtering', async () => {
    await database.attempts.bulkAdd([
      attempt('agent-loop-001', '2026-09-19T10:00:00.000Z', false),
      attempt('agent-loop-001', '2026-09-19T11:00:00.000Z', true),
      attempt('sse-001', '2026-09-19T10:00:00.000Z', true),
      attempt('sse-001', '2026-09-19T11:00:00.000Z', false),
    ]);
    const questions = await selectPracticeQuestions(database, questionPrompts, {
      subject: 'agent',
      mode: 'wrong',
    });
    expect(questions.map((question) => question.id)).toEqual(['sse-001']);
  });

  it('filters favorites with one primary-key scan', async () => {
    await database.favorites.bulkAdd([
      { questionId: 'agent-loop-001', createdAt: '2026-09-19T10:00:00.000Z' },
      { questionId: 'temperature-determinism-001', createdAt: '2026-09-19T10:00:00.000Z' },
    ]);
    const questions = await selectPracticeQuestions(database, questionPrompts, {
      subject: 'agent',
      mode: 'favorite',
    });
    expect(questions.map((question) => question.id)).toEqual(['agent-loop-001']);
  });

  it('keeps different question types in the same selected session', async () => {
    const questions = await selectPracticeQuestions(database, questionPrompts, {
      subject: 'agent',
      mode: 'all',
    });
    expect(new Set(questions.map((question) => question.type))).toEqual(
      new Set(['single_choice', 'multiple_choice', 'oral']),
    );
  });
});
