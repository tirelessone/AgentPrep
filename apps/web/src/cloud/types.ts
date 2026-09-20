import { z } from 'zod';

import type { FavoriteQuestion, LocalSetting, StudyAttempt } from '@agentprep/domain';

export const cloudTimestampSchema = z.iso.datetime({ offset: true });

export const questionResponseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('single_choice'), selectedChoiceId: z.string().min(1) }),
  z.object({
    type: z.literal('multiple_choice'),
    selectedChoiceIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({ type: z.literal('true_false'), answer: z.boolean() }),
  z.object({
    type: z.literal('oral'),
    selfAssessment: z.enum(['understood', 'needs_review']),
  }),
]);

export const studyAttemptSchema: z.ZodType<StudyAttempt> = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  questionVersion: z.string().min(1),
  attemptedAt: cloudTimestampSchema,
  selectedChoiceIds: z.array(z.string().min(1)),
  response: questionResponseSchema.optional(),
  correct: z.boolean(),
});

export const favoriteStateSchema: z.ZodType<FavoriteQuestion> = z.object({
  questionId: z.string().min(1),
  isFavorite: z.boolean(),
  createdAt: cloudTimestampSchema,
  updatedAt: cloudTimestampSchema,
});

export const localSettingSchema: z.ZodType<LocalSetting> = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: cloudTimestampSchema,
});

export const syncableSettingKeys = new Set(['theme', 'practice-count', 'practice-order']);

export function isSyncableSetting(setting: LocalSetting) {
  return syncableSettingKeys.has(setting.key);
}

export interface CloudStudyStore {
  fetchAttempts(): Promise<readonly StudyAttempt[]>;
  fetchFavorites(): Promise<readonly FavoriteQuestion[]>;
  fetchSettings(): Promise<readonly LocalSetting[]>;
  upsertAttempts(attempts: readonly StudyAttempt[]): Promise<void>;
  upsertFavorites(favorites: readonly FavoriteQuestion[]): Promise<void>;
  upsertSettings(settings: readonly LocalSetting[]): Promise<void>;
}

export interface SyncWarning {
  kind: 'attempt-payload-conflict';
  id: string;
  message: string;
}

export interface ReconcileResult {
  attempts: number;
  favorites: number;
  settings: number;
  pushed: {
    attempts: number;
    favorites: number;
    settings: number;
  };
  warnings: readonly SyncWarning[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
