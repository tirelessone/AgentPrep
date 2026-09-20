import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { QuestionPrompt, StudyAttempt } from '@agentprep/domain';

import originalManifest from '../../../../../content/manifests/original-v2.json';

import { createQuestionContent } from '../../content';
import { AgentPrepDatabase } from '../../db';
import {
  filterQuestionsByTaxonomy,
  getAvailableSubjectSummaries,
  getChapterSummaries,
  selectPracticeQuestions,
  shuffleQuestions,
} from './practice-selection';

const questionPrompts = createQuestionContent(originalManifest).questionPrompts;
const sequentialAll = { count: 'all', order: 'sequential' } as const;

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
      ...sequentialAll,
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
      ...sequentialAll,
    });
    expect(questions.map((question) => question.id)).toEqual(['sse-001']);
  });

  it('filters active favorites while ignoring tombstones', async () => {
    await database.favorites.bulkAdd([
      {
        questionId: 'agent-loop-001',
        isFavorite: true,
        createdAt: '2026-09-19T10:00:00.000Z',
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
      {
        questionId: 'temperature-determinism-001',
        isFavorite: false,
        createdAt: '2026-09-19T10:00:00.000Z',
        updatedAt: '2026-09-19T11:00:00.000Z',
      },
    ]);
    const questions = await selectPracticeQuestions(database, questionPrompts, {
      subject: 'agent',
      mode: 'favorite',
      ...sequentialAll,
    });
    expect(questions.map((question) => question.id)).toEqual(['agent-loop-001']);
  });

  it('keeps different question types in the same selected session', async () => {
    const questions = await selectPracticeQuestions(database, questionPrompts, {
      subject: 'agent',
      mode: 'all',
      ...sequentialAll,
    });
    expect(new Set(questions.map((question) => question.type))).toEqual(
      new Set(['single_choice', 'multiple_choice', 'oral']),
    );
  });

  it('creates deterministic random queues of 20 and 50 questions', async () => {
    const questions = Array.from({ length: 60 }, (_, index) => ({
      ...questionPrompts[0]!,
      id: `generated-${String(index).padStart(2, '0')}`,
    })) satisfies QuestionPrompt[];
    const random = () => 0;

    const twenty = await selectPracticeQuestions(
      database,
      questions,
      { subject: 'agent', mode: 'all', count: 20, order: 'random' },
      random,
    );
    const fifty = await selectPracticeQuestions(
      database,
      questions,
      { subject: 'agent', mode: 'all', count: 50, order: 'random' },
      random,
    );
    expect(twenty).toHaveLength(20);
    expect(fifty).toHaveLength(50);
    expect(twenty.map(({ id }) => id)).toEqual(
      shuffleQuestions(questions, random)
        .slice(0, 20)
        .map(({ id }) => id),
    );
  });

  it('keeps source order and all questions for a sequential all-sized queue', async () => {
    const questions = Array.from({ length: 60 }, (_, index) => ({
      ...questionPrompts[0]!,
      id: `sequential-${String(index).padStart(2, '0')}`,
    })) satisfies QuestionPrompt[];
    const selected = await selectPracticeQuestions(database, questions, {
      subject: 'agent',
      mode: 'all',
      count: 'all',
      order: 'sequential',
    });
    expect(selected.map(({ id }) => id)).toEqual(questions.map(({ id }) => id));
  });
});
