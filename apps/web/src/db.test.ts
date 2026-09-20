import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { createAgentPrepDatabase, getUserDatabaseName, type AgentPrepDatabase } from './db';

const databases: AgentPrepDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

function createUserDatabase(userId: string) {
  const database = createAgentPrepDatabase(getUserDatabaseName(userId));
  databases.push(database);
  return database;
}

describe('per-user local databases', () => {
  it('uses a stable account-specific database name', () => {
    expect(getUserDatabaseName('alice-id')).toBe('agentprep-user-alice-id');
    expect(() => getUserDatabaseName(' ')).toThrow('user id');
  });

  it('isolates Alice and Bob while retaining each account cache', async () => {
    const alice = createUserDatabase('alice-id');
    await alice.settings.put({
      key: 'theme',
      value: 'alice-theme',
      updatedAt: '2026-09-20T08:00:00.000Z',
    });
    alice.close();

    const bob = createUserDatabase('bob-id');
    await expect(bob.settings.get('theme')).resolves.toBeUndefined();
    await bob.settings.put({
      key: 'theme',
      value: 'bob-theme',
      updatedAt: '2026-09-20T09:00:00.000Z',
    });
    bob.close();

    const aliceAgain = createUserDatabase('alice-id');
    await expect(aliceAgain.settings.get('theme')).resolves.toMatchObject({
      value: 'alice-theme',
    });
  });
});
