import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { exportStudyData, importStudyData } from './backup';
import { questionPrompts, revealQuestion } from './content';
import { AgentPrepDatabase } from './db';
import {
  getDueReviewQuestionIds,
  getLatestWrongQuestionIds,
  recordAttempt,
  toggleFavorite,
} from './study-service';

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
    const attempt = await recordAttempt(database, prompt, revealQuestion(prompt.id), ['a'], now);

    expect(attempt.correct).toBe(false);
    await expect(getLatestWrongQuestionIds(database)).resolves.toEqual([prompt.id]);
    await expect(getDueReviewQuestionIds(database, now)).resolves.toEqual([prompt.id]);
  });

  it('toggles favorites without duplicate records', async () => {
    const questionId = questionPrompts[0]!.id;

    await expect(toggleFavorite(database, questionId)).resolves.toBe(true);
    await expect(database.favorites.count()).resolves.toBe(1);
    await expect(toggleFavorite(database, questionId)).resolves.toBe(false);
    await expect(database.favorites.count()).resolves.toBe(0);
  });

  it('round-trips validated learning data without question answers', async () => {
    const prompt = questionPrompts[0]!;
    await recordAttempt(database, prompt, revealQuestion(prompt.id), ['b']);
    await toggleFavorite(database, prompt.id);

    const exported = await exportStudyData(database, new Date('2026-09-19T09:00:00.000Z'));
    expect(exported).not.toContain('correctChoiceIds');
    expect(exported).not.toContain('explanation');

    const restored = new AgentPrepDatabase(`agentprep-restore-${crypto.randomUUID()}`);
    try {
      await importStudyData(restored, exported);
      await expect(restored.attempts.count()).resolves.toBe(1);
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
      expect(migrated.verno).toBe(2);
    } finally {
      await migrated.delete();
    }
  });
});
