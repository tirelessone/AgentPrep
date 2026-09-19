import { z } from 'zod';

import type { AgentPrepDatabase } from './db';

const attemptSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  questionVersion: z.string().min(1),
  attemptedAt: z.iso.datetime(),
  selectedChoiceIds: z.array(z.string().min(1)),
  correct: z.boolean(),
});

const favoriteSchema = z.object({
  questionId: z.string().min(1),
  createdAt: z.iso.datetime(),
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

export const studyBackupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  data: z.object({
    attempts: z.array(attemptSchema),
    favorites: z.array(favoriteSchema),
    reviews: z.array(reviewSchema),
    settings: z.array(settingSchema),
  }),
});

const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export async function exportStudyData(database: AgentPrepDatabase, now = new Date()) {
  const [attempts, favorites, reviews, settings] = await Promise.all([
    database.attempts.toArray(),
    database.favorites.toArray(),
    database.reviews.toArray(),
    database.settings.toArray(),
  ]);

  return JSON.stringify(
    {
      schemaVersion: 1,
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

  const backup = studyBackupSchema.parse(raw);
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
      await database.settings.bulkPut(backup.data.settings);
    },
  );

  return backup;
}
