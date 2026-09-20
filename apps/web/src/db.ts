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
    this.version(3)
      .stores({
        settings: '&key, updatedAt',
        attempts: '&id, questionId, attemptedAt, correct, [questionId+attemptedAt]',
        favorites: '&questionId, updatedAt, createdAt',
        reviews: '&questionId, dueAt, updatedAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<{
            questionId: string;
            createdAt: string;
            isFavorite?: boolean;
            updatedAt?: string;
          }>('favorites')
          .toCollection()
          .modify((favorite) => {
            favorite.isFavorite ??= true;
            favorite.updatedAt ??= favorite.createdAt;
          });
      });
  }
}

export const db = new AgentPrepDatabase();
