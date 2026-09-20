import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import originalManifest from '../../../content/manifests/original-v2.json';

import { exportStudyData, importStudyData } from './backup';
import { createQuestionContent } from './content';
import { AgentPrepDatabase } from './db';
import {
  getDueReviewQuestionIds,
  getLatestWrongQuestionIds,
  rebuildReviewsFromAttempts,
  recordAttempt,
  toggleFavorite,
} from './study-service';

const { questionPrompts, revealQuestion } = createQuestionContent(originalManifest);

let database: AgentPrepDatabase;

beforeEach(() => {
  database = new AgentPrepDatabase(`agentprep-test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await database.delete();
});

describe('local study services', () => {
  it('records wrong answers and schedules an immediate review', async () => {
    const prompt = questionPrompts[0]!;
    const now = new Date('2026-09-19T08:00:00.000Z');
    const attempt = await recordAttempt(
      database,
      prompt,
      revealQuestion(prompt.id),
      { type: 'single_choice', selectedChoiceId: 'a' },
      now,
    );

    expect(attempt.correct).toBe(false);
    await expect(getLatestWrongQuestionIds(database)).resolves.toEqual([prompt.id]);
    await expect(getDueReviewQuestionIds(database, now)).resolves.toEqual([prompt.id]);
  });

  it('toggles favorites with a last-write-wins tombstone', async () => {
    const questionId = questionPrompts[0]!.id;

    await expect(
      toggleFavorite(database, questionId, new Date('2026-09-19T08:00:00.000Z')),
    ).resolves.toBe(true);
    await expect(database.favorites.count()).resolves.toBe(1);
    await expect(
      toggleFavorite(database, questionId, new Date('2026-09-19T09:00:00.000Z')),
    ).resolves.toBe(false);
    await expect(database.favorites.get(questionId)).resolves.toEqual({
      questionId,
      isFavorite: false,
      createdAt: '2026-09-19T08:00:00.000Z',
      updatedAt: '2026-09-19T09:00:00.000Z',
    });
  });

  it('rebuilds the same review state produced by incremental attempts', async () => {
    const prompt = questionPrompts[0]!;
    const reveal = revealQuestion(prompt.id);
    await recordAttempt(
      database,
      prompt,
      reveal,
      { type: 'single_choice', selectedChoiceId: 'b' },
      new Date('2026-09-19T08:00:00.000Z'),
    );
    await recordAttempt(
      database,
      prompt,
      reveal,
      { type: 'single_choice', selectedChoiceId: 'a' },
      new Date('2026-09-20T08:00:00.000Z'),
    );
    await recordAttempt(
      database,
      prompt,
      reveal,
      { type: 'single_choice', selectedChoiceId: 'b' },
      new Date('2026-09-21T08:00:00.000Z'),
    );

    const attempts = await database.attempts.toArray();
    const incremental = await database.reviews.toArray();
    expect(rebuildReviewsFromAttempts(attempts)).toEqual(incremental);
  });

  it('round-trips validated learning data without question answers', async () => {
    const prompt = questionPrompts[0]!;
    await recordAttempt(database, prompt, revealQuestion(prompt.id), {
      type: 'single_choice',
      selectedChoiceId: 'b',
    });
    await toggleFavorite(database, prompt.id);

    const exported = await exportStudyData(database, new Date('2026-09-19T09:00:00.000Z'));
    expect(exported).not.toContain('correctChoiceIds');
    expect(exported).not.toContain('explanation');

    const restored = new AgentPrepDatabase(`agentprep-restore-${crypto.randomUUID()}`);
    try {
      await importStudyData(restored, exported);
      await expect(restored.attempts.count()).resolves.toBe(1);
      await expect(restored.attempts.toCollection().first()).resolves.toMatchObject({
        response: { type: 'single_choice', selectedChoiceId: 'b' },
      });
      await expect(restored.favorites.get(prompt.id)).resolves.toMatchObject({
        questionId: prompt.id,
      });
    } finally {
      await restored.delete();
    }
  });

  it('rejects malformed imports before replacing existing data', async () => {
    const prompt = questionPrompts[0]!;
    await toggleFavorite(database, prompt.id);

    await expect(importStudyData(database, '{"schemaVersion":99}')).rejects.toThrow();
    await expect(database.favorites.count()).resolves.toBe(1);
  });

  it('imports backup schema v1 favorites as active tombstones', async () => {
    const questionId = questionPrompts[0]!.id;
    const legacyBackup = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-09-19T09:00:00.000Z',
      data: {
        attempts: [],
        favorites: [{ questionId, createdAt: '2026-09-19T08:00:00.000Z' }],
        reviews: [],
        settings: [],
      },
    });

    await expect(importStudyData(database, legacyBackup)).resolves.toMatchObject({
      schemaVersion: 2,
    });
    await expect(database.favorites.get(questionId)).resolves.toEqual({
      questionId,
      isFavorite: true,
      createdAt: '2026-09-19T08:00:00.000Z',
      updatedAt: '2026-09-19T08:00:00.000Z',
    });
  });

  it('validates and grades multiple-choice responses without depending on order', async () => {
    const prompt = questionPrompts.find((item) => item.id === 'rag-grounding-001')!;
    const reveal = revealQuestion(prompt.id);
    const attempt = await recordAttempt(database, prompt, reveal, {
      type: 'multiple_choice',
      selectedChoiceIds: ['e', 'a', 'c'],
    });
    expect(attempt.correct).toBe(true);
    await expect(
      recordAttempt(database, prompt, reveal, {
        type: 'multiple_choice',
        selectedChoiceIds: ['a', 'missing'],
      }),
    ).rejects.toThrow('not valid');
  });

  it('grades true/false responses using a boolean answer', async () => {
    const prompt = questionPrompts.find((item) => item.id === 'temperature-determinism-001')!;
    const attempt = await recordAttempt(database, prompt, revealQuestion(prompt.id), {
      type: 'true_false',
      answer: false,
    });
    expect(attempt).toMatchObject({
      correct: true,
      selectedChoiceIds: [],
      response: { type: 'true_false', answer: false },
    });
  });

  it('records oral self-assessment without pretending it has choices', async () => {
    const prompt = questionPrompts.find((item) => item.id === 'agent-loop-oral-001')!;
    const attempt = await recordAttempt(database, prompt, revealQuestion(prompt.id), {
      type: 'oral',
      selfAssessment: 'needs_review',
    });
    expect(attempt).toMatchObject({
      correct: false,
      selectedChoiceIds: [],
      response: { type: 'oral', selfAssessment: 'needs_review' },
    });
  });
});

describe('database migrations', () => {
  it('preserves version 1 settings while adding learning tables', async () => {
    const name = `agentprep-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({ settings: '&key, updatedAt' });
    await legacy.table('settings').put({
      key: 'legacy-theme',
      value: 'light',
      updatedAt: '2026-09-19T00:00:00.000Z',
    });
    legacy.close();

    const migrated = new AgentPrepDatabase(name);
    try {
      await migrated.open();
      await expect(migrated.settings.get('legacy-theme')).resolves.toMatchObject({
        value: 'light',
      });
      await expect(migrated.attempts.count()).resolves.toBe(0);
      expect(migrated.verno).toBe(3);
    } finally {
      await migrated.delete();
    }
  });

  it('preserves version 2 favorites while adding tombstone metadata', async () => {
    const name = `agentprep-favorite-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(2).stores({
      settings: '&key, updatedAt',
      attempts: '&id, questionId, attemptedAt, correct, [questionId+attemptedAt]',
      favorites: '&questionId, createdAt',
      reviews: '&questionId, dueAt, updatedAt',
    });
    await legacy.table('favorites').put({
      questionId: 'legacy-question',
      createdAt: '2026-09-19T00:00:00.000Z',
    });
    legacy.close();

    const migrated = new AgentPrepDatabase(name);
    try {
      await migrated.open();
      await expect(migrated.favorites.get('legacy-question')).resolves.toEqual({
        questionId: 'legacy-question',
        isFavorite: true,
        createdAt: '2026-09-19T00:00:00.000Z',
        updatedAt: '2026-09-19T00:00:00.000Z',
      });
      expect(migrated.verno).toBe(3);
    } finally {
      await migrated.delete();
    }
  });
});
