import { describe, expect, it, vi } from 'vitest';

import { streamTutor, TutorClientError } from './tutor-client';

describe('Tutor SSE client', () => {
  it('parses streamed token events', async () => {
    const encoder = new TextEncoder();
    const fetcher = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode('event: token\ndata: {"text":"你"}\n\n'));
              controller.enqueue(
                encoder.encode('event: token\ndata: {"text":"好"}\n\nevent: done\ndata: {}\n\n'),
              );
              controller.close();
            },
          }),
        ),
    ) as unknown as typeof fetch;
    const output: string[] = [];
    for await (const token of streamTutor({ mode: 'free_chat', message: 'hello' }, { fetcher }))
      output.push(token);
    expect(output.join('')).toBe('你好');
  });

  it('surfaces safe provider errors', async () => {
    const body = 'event: error\ndata: {"code":"PROVIDER_ERROR","message":"暂时不可用"}\n\n';
    const fetcher = vi.fn(async () => new Response(body)) as unknown as typeof fetch;
    const consume = async () => {
      for await (const token of streamTutor({ mode: 'free_chat', message: 'hello' }, { fetcher }))
        void token;
    };
    await expect(consume()).rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
  });

  it('cancels an in-flight request', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    ) as unknown as typeof fetch;
    const consume = async () => {
      for await (const token of streamTutor(
        { mode: 'free_chat', message: 'hello' },
        { fetcher, signal: controller.signal },
      ))
        void token;
    };
    const pending = consume();
    controller.abort();
    await expect(pending).rejects.toEqual(
      expect.objectContaining<TutorClientError>({ code: 'CANCELLED' }),
    );
  });
});
