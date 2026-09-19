import { describe, expect, it, vi } from 'vitest';

import { OpenAICompatibleProvider } from './openai-provider.js';

describe('OpenAICompatibleProvider', () => {
  it('converts OpenAI-compatible SSE chunks into Tutor chunks', async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n'),
          );
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n'),
          );
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    const fetcher = fetchMock as unknown as typeof fetch;

    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://provider.example/v1/',
      apiKey: 'server-secret',
      model: 'test-model',
      fetcher,
    });
    const chunks: string[] = [];
    for await (const chunk of provider.stream(
      { mode: 'free_chat', message: 'hi' },
      new AbortController().signal,
    )) {
      chunks.push(chunk.text);
    }

    expect(chunks.join('')).toBe('Hello world');
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://provider.example/v1/chat/completions');
    expect(init?.headers).toMatchObject({ authorization: 'Bearer server-secret' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'test-model', stream: true });
  });
});
