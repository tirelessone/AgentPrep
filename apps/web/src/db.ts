import Dexie, { type EntityTable } from 'dexie';

import type { FavoriteQuestion, LocalSetting, ReviewItem, StudyAttempt } from '@agentprep/domain';

export class AgentPrepDatabase extends Dexie {
  settings!: EntityTable<LocalSetting, 'key'>;
  attempts!: EntityTable<StudyAttempt, 'id'>;
  favorites!: EntityTable<FavoriteQuestion, 'questionId'>;
  reviews!: EntityTable<ReviewItem, 'questionId'>;

  constructor(name = 'agentprep') {
    super(name);
    this.version(1).stores({
      settings: '&key, updatedAt',
    });
    this.version(2).stores({
      settings: '&key, updatedAt',
      attempts: '&id, questionId, attemptedAt, correct, [questionId+attemptedAt]',
      favorites: '&questionId, createdAt',
      reviews: '&questionId, dueAt, updatedAt',
    });
  }
}

export const db = new AgentPrepDatabase();
