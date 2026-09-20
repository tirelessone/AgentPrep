import { z } from 'zod';

import type { AgentPrepDatabase } from './db';

const responseSchema = z.discriminatedUnion('type', [
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

const attemptSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  questionVersion: z.string().min(1),
  attemptedAt: z.iso.datetime(),
  selectedChoiceIds: z.array(z.string().min(1)),
  response: responseSchema.optional(),
  correct: z.boolean(),
});

const favoriteV1Schema = z.object({
  questionId: z.string().min(1),
  createdAt: z.iso.datetime(),
});

const favoriteSchema = favoriteV1Schema.extend({
  isFavorite: z.boolean(),
  updatedAt: z.iso.datetime(),
});

const reviewSchema = z.object({
  questionId: z.string().min(1),
  dueAt: z.iso.datetime(),
  intervalDays: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
});

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  updatedAt: z.iso.datetime(),
});

const backupDataV1Schema = z.object({
  attempts: z.array(attemptSchema),
  favorites: z.array(favoriteV1Schema),
  reviews: z.array(reviewSchema),
  settings: z.array(settingSchema),
});

const backupDataV2Schema = backupDataV1Schema.extend({
  favorites: z.array(favoriteSchema),
});

export const studyBackupV1Schema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  data: backupDataV1Schema,
});

export const studyBackupSchema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: z.iso.datetime(),
  data: backupDataV2Schema,
});

const supportedBackupSchema = z.discriminatedUnion('schemaVersion', [
  studyBackupV1Schema,
  studyBackupSchema,
]);

const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

function isPortableSetting(key: string) {
  return !key.startsWith('device:');
}

export async function exportStudyData(database: AgentPrepDatabase, now = new Date()) {
  const [attempts, favorites, reviews, settings] = await Promise.all([
    database.attempts.toArray(),
    database.favorites.toArray(),
    database.reviews.toArray(),
    database.settings.filter((setting) => isPortableSetting(setting.key)).toArray(),
  ]);

  return JSON.stringify(
    {
      schemaVersion: 2,
      exportedAt: now.toISOString(),
      data: { attempts, favorites, reviews, settings },
    },
    null,
    2,
  );
}

export async function importStudyData(database: AgentPrepDatabase, text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Backup exceeds the 2 MiB safety limit.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Backup is not valid JSON.');
  }

  const parsed = supportedBackupSchema.parse(raw);
  const backup =
    parsed.schemaVersion === 1
      ? {
          schemaVersion: 2 as const,
          exportedAt: parsed.exportedAt,
          data: {
            ...parsed.data,
            favorites: parsed.data.favorites.map((favorite) => ({
              ...favorite,
              isFavorite: true,
              updatedAt: favorite.createdAt,
            })),
          },
        }
      : parsed;
  await database.transaction(
    'rw',
    [database.attempts, database.favorites, database.reviews, database.settings],
    async () => {
      await Promise.all([
        database.attempts.clear(),
        database.favorites.clear(),
        database.reviews.clear(),
        database.settings.clear(),
      ]);
      await database.attempts.bulkPut(backup.data.attempts);
      await database.favorites.bulkPut(backup.data.favorites);
      await database.reviews.bulkPut(backup.data.reviews);
      await database.settings.bulkPut(
        backup.data.settings.filter((setting) => isPortableSetting(setting.key)),
      );
    },
  );

  return backup;
}
