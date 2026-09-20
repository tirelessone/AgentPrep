import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FavoriteQuestion, LocalSetting, StudyAttempt } from '@agentprep/domain';

import { questionResponseSchema } from './types';
import type { CloudStudyStore } from './types';

export const CLOUD_PAGE_SIZE = 500;
export const CLOUD_WRITE_CHUNK_SIZE = 250;

const attemptRowSchema = z.object({
  user_id: z.uuid(),
  id: z.uuid(),
  question_id: z.string().min(1),
  question_version: z.string().min(1),
  attempted_at: z.iso.datetime(),
  selected_choice_ids: z.array(z.string().min(1)),
  response: questionResponseSchema.nullable(),
  correct: z.boolean(),
});

const favoriteRowSchema = z.object({
  user_id: z.uuid(),
  question_id: z.string().min(1),
  is_favorite: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

const settingRowSchema = z.object({
  user_id: z.uuid(),
  key: z.string().min(1),
  value: z.unknown(),
  updated_at: z.iso.datetime(),
});

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<readonly T[]>,
  pageSize = CLOUD_PAGE_SIZE,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function writeInChunks<T>(
  values: readonly T[],
  write: (chunk: readonly T[]) => Promise<void>,
  chunkSize = CLOUD_WRITE_CHUNK_SIZE,
) {
  for (let index = 0; index < values.length; index += chunkSize) {
    await write(values.slice(index, index + chunkSize));
  }
}

export class SupabaseCloudStudyStore implements CloudStudyStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {
    z.uuid().parse(userId);
  }

  async fetchAttempts() {
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await this.client
        .from('study_attempts')
        .select(
          'user_id,id,question_id,question_version,attempted_at,selected_choice_ids,response,correct',
        )
        .eq('user_id', this.userId)
        .order('attempted_at', { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return attemptRowSchema.array().parse(data);
    });
    return rows.map((row): StudyAttempt => {
      this.assertOwnRow(row.user_id);
      return {
        id: row.id,
        questionId: row.question_id,
        questionVersion: row.question_version,
        attemptedAt: row.attempted_at,
        selectedChoiceIds: row.selected_choice_ids,
        ...(row.response ? { response: row.response } : {}),
        correct: row.correct,
      };
    });
  }

  async fetchFavorites() {
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await this.client
        .from('favorite_states')
        .select('user_id,question_id,is_favorite,created_at,updated_at')
        .eq('user_id', this.userId)
        .order('updated_at', { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return favoriteRowSchema.array().parse(data);
    });
    return rows.map((row): FavoriteQuestion => {
      this.assertOwnRow(row.user_id);
      return {
        questionId: row.question_id,
        isFavorite: row.is_favorite,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async fetchSettings() {
    const rows = await fetchAllPages(async (from, to) => {
      const { data, error } = await this.client
        .from('user_settings')
        .select('user_id,key,value,updated_at')
        .eq('user_id', this.userId)
        .order('updated_at', { ascending: true })
        .range(from, to);
      if (error) throw new Error(error.message);
      return settingRowSchema.array().parse(data);
    });
    return rows.map((row): LocalSetting => {
      this.assertOwnRow(row.user_id);
      return { key: row.key, value: row.value, updatedAt: row.updated_at };
    });
  }

  async upsertAttempts(attempts: readonly StudyAttempt[]) {
    await writeInChunks(attempts, async (chunk) => {
      const { error } = await this.client.from('study_attempts').upsert(
        chunk.map((attempt) => ({
          user_id: this.userId,
          id: attempt.id,
          question_id: attempt.questionId,
          question_version: attempt.questionVersion,
          attempted_at: attempt.attemptedAt,
          selected_choice_ids: attempt.selectedChoiceIds,
          response: attempt.response ?? null,
          correct: attempt.correct,
        })),
        { onConflict: 'user_id,id', ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    });
  }

  async upsertFavorites(favorites: readonly FavoriteQuestion[]) {
    await writeInChunks(favorites, async (chunk) => {
      const { error } = await this.client.from('favorite_states').upsert(
        chunk.map((favorite) => ({
          user_id: this.userId,
          question_id: favorite.questionId,
          is_favorite: favorite.isFavorite,
          created_at: favorite.createdAt,
          updated_at: favorite.updatedAt,
        })),
        { onConflict: 'user_id,question_id' },
      );
      if (error) throw new Error(error.message);
    });
  }

  async upsertSettings(settings: readonly LocalSetting[]) {
    await writeInChunks(settings, async (chunk) => {
      const { error } = await this.client.from('user_settings').upsert(
        chunk.map((setting) => ({
          user_id: this.userId,
          key: setting.key,
          value: setting.value,
          updated_at: setting.updatedAt,
        })),
        { onConflict: 'user_id,key' },
      );
      if (error) throw new Error(error.message);
    });
  }

  private assertOwnRow(userId: string) {
    if (userId !== this.userId) throw new Error('Cloud returned a row for a different user.');
  }
}
