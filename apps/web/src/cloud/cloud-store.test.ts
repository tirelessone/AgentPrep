import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CLOUD_PAGE_SIZE,
  CLOUD_WRITE_CHUNK_SIZE,
  fetchAllPages,
  SupabaseCloudStudyStore,
  writeInChunks,
} from './cloud-store';

describe('Supabase cloud store batching', () => {
  it('paginates attempts until the final short page', async () => {
    const source = Array.from({ length: CLOUD_PAGE_SIZE * 2 + 3 }, (_, index) => index);
    const fetchPage = vi.fn(async (from: number, to: number) => source.slice(from, to + 1));

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(source);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, CLOUD_PAGE_SIZE - 1);
    expect(fetchPage).toHaveBeenNthCalledWith(3, CLOUD_PAGE_SIZE * 2, CLOUD_PAGE_SIZE * 3 - 1);
  });

  it('writes large upserts in bounded chunks', async () => {
    const values = Array.from({ length: CLOUD_WRITE_CHUNK_SIZE * 2 + 1 }, (_, index) => index);
    const sizes: number[] = [];

    await writeInChunks(values, async (chunk) => {
      sizes.push(chunk.length);
    });

    expect(sizes).toEqual([CLOUD_WRITE_CHUNK_SIZE, CLOUD_WRITE_CHUNK_SIZE, 1]);
  });

  it('always derives user_id from the authenticated store scope', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient;
    const userId = '11111111-1111-4111-8111-111111111111';
    const store = new SupabaseCloudStudyStore(client, userId);

    await store.upsertAttempts([
      {
        id: '22222222-2222-4222-8222-222222222222',
        questionId: 'question-1',
        questionVersion: '2.1.0',
        attemptedAt: '2026-09-20T08:00:00.000Z',
        selectedChoiceIds: ['a'],
        correct: true,
      },
    ]);

    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ user_id: userId })],
      expect.objectContaining({ onConflict: 'user_id,id', ignoreDuplicates: true }),
    );
  });

  it('rejects a valid remote row belonging to another user', async () => {
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.range = vi.fn(async () => ({
      error: null,
      data: [
        {
          user_id: '33333333-3333-4333-8333-333333333333',
          id: '22222222-2222-4222-8222-222222222222',
          question_id: 'question-1',
          question_version: '2.1.0',
          attempted_at: '2026-09-20T08:00:00.000Z',
          selected_choice_ids: ['a'],
          response: null,
          correct: true,
        },
      ],
    }));
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;
    const store = new SupabaseCloudStudyStore(client, '11111111-1111-4111-8111-111111111111');

    await expect(store.fetchAttempts()).rejects.toThrow('different user');
  });
});
