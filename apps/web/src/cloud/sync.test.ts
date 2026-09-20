import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FavoriteQuestion, LocalSetting, StudyAttempt } from '@agentprep/domain';

import { AgentPrepDatabase } from '../db';
import { hasLocalStudyData, mergeLocalStudyData } from './local-migration';
import { mergeAttempts, mergeFavorites, mergeSettings } from './merge';
import { reconcileStudyState, SyncCoordinator } from './sync';
import { FakeCloudStudyStore } from './testing';

let databases: AgentPrepDatabase[];

beforeEach(() => {
  databases = [];
});

afterEach(async () => {
  await Promise.all(databases.map((database) => database.delete()));
});

function database(label: string) {
  const value = new AgentPrepDatabase(`agentprep-${label}-${crypto.randomUUID()}`);
  databases.push(value);
  return value;
}

function attempt(
  id: string,
  questionId: string,
  attemptedAt: string,
  correct: boolean,
): StudyAttempt {
  return {
    id,
    questionId,
    questionVersion: '2.1.0',
    attemptedAt,
    selectedChoiceIds: ['a'],
    response: { type: 'single_choice', selectedChoiceId: 'a' },
    correct,
  };
}

function favorite(questionId: string, isFavorite: boolean, updatedAt: string): FavoriteQuestion {
  return { questionId, isFavorite, createdAt: '2026-09-20T08:00:00.000Z', updatedAt };
}

function setting(key: string, value: unknown, updatedAt: string): LocalSetting {
  return { key, value, updatedAt };
}

describe('cloud merge rules', () => {
  it('unions attempts and preserves cloud on an impossible id conflict', () => {
    const local = attempt('same-id', 'q-local', '2026-09-20T08:00:00.000Z', true);
    const cloud = attempt('same-id', 'q-cloud', '2026-09-20T08:00:00.000Z', false);
    const result = mergeAttempts(
      [local, attempt('local-only', 'q1', '2026-09-20T09:00:00.000Z', true)],
      [cloud, attempt('cloud-only', 'q2', '2026-09-20T10:00:00.000Z', false)],
    );

    expect(result.merged).toHaveLength(3);
    expect(result.merged.find((item) => item.id === 'same-id')).toEqual(cloud);
    expect(result.toCloud.map((item) => item.id)).toEqual(['local-only']);
    expect(result.warnings).toHaveLength(1);
  });

  it('uses latest updatedAt for favorites and settings', () => {
    const favorites = mergeFavorites(
      [favorite('q1', true, '2026-09-20T10:00:00.000Z')],
      [favorite('q1', false, '2026-09-20T10:05:00.000Z')],
    );
    const settings = mergeSettings(
      [setting('theme', 'X', '2026-09-20T10:00:00.000Z')],
      [setting('theme', 'Y', '2026-09-20T10:05:00.000Z')],
    );

    expect(favorites.merged[0]?.isFavorite).toBe(false);
    expect(settings.merged[0]?.value).toBe('Y');
    expect(favorites.toCloud).toEqual([]);
    expect(settings.toCloud).toEqual([]);
  });
});

describe('study reconciliation', () => {
  it('converges two devices and rebuilds reviews from all attempts', async () => {
    const cloud = new FakeCloudStudyStore();
    const deviceA = database('device-a');
    const deviceB = database('device-b');
    await deviceA.attempts.add(attempt('a', 'q1', '2026-09-20T08:00:00.000Z', false));
    await deviceA.favorites.add(favorite('q1', true, '2026-09-20T08:00:00.000Z'));
    await reconcileStudyState(deviceA, cloud);

    await reconcileStudyState(deviceB, cloud);
    await expect(deviceB.attempts.count()).resolves.toBe(1);
    await expect(deviceB.favorites.get('q1')).resolves.toMatchObject({ isFavorite: true });

    await deviceB.attempts.add(attempt('b', 'q1', '2026-09-20T09:00:00.000Z', true));
    await deviceB.favorites.put(favorite('q1', false, '2026-09-20T09:05:00.000Z'));
    await reconcileStudyState(deviceB, cloud);
    await reconcileStudyState(deviceA, cloud);

    await expect(deviceA.attempts.count()).resolves.toBe(2);
    await expect(deviceA.favorites.get('q1')).resolves.toMatchObject({ isFavorite: false });
    await expect(deviceA.reviews.get('q1')).resolves.toMatchObject({
      intervalDays: 1,
      streak: 1,
      dueAt: '2026-09-21T09:00:00.000Z',
    });
  });

  it('rejects untrusted remote rows before writing IndexedDB', async () => {
    const local = database('invalid-remote');
    const cloud = new FakeCloudStudyStore();
    cloud.fetchAttempts = async () => [{ id: 'missing-fields' } as StudyAttempt];

    await expect(reconcileStudyState(local, cloud)).rejects.toThrow();
    await expect(local.attempts.count()).resolves.toBe(0);
  });

  it('coalesces concurrent reconcile triggers into one request', async () => {
    const local = database('mutex');
    const cloud = new FakeCloudStudyStore();
    const coordinator = new SyncCoordinator();
    const first = coordinator.reconcile(local, cloud);
    const second = coordinator.reconcile(local, cloud);

    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(cloud.fetchCount).toBe(1);
  });

  it('merges guest data into an account cache without deleting guest data', async () => {
    const guest = database('guest');
    const account = database('account');
    await guest.attempts.add(attempt('guest-attempt', 'q1', '2026-09-20T08:00:00.000Z', false));
    await guest.favorites.add(favorite('q1', true, '2026-09-20T08:00:00.000Z'));
    await guest.settings.add(setting('theme', 'guest', '2026-09-20T08:00:00.000Z'));

    await expect(hasLocalStudyData(guest)).resolves.toBe(true);
    await mergeLocalStudyData(guest, account);

    await expect(account.attempts.count()).resolves.toBe(1);
    await expect(account.favorites.get('q1')).resolves.toMatchObject({ isFavorite: true });
    await expect(account.reviews.get('q1')).resolves.toMatchObject({ intervalDays: 0 });
    await expect(guest.attempts.count()).resolves.toBe(1);
  });
});
