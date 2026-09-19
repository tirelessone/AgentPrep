import { tutorRequestSchema, type TutorRequest } from '@agentprep/tutor-core';

export class TutorClientError extends Error {
  constructor(
    readonly code: 'INVALID_RESPONSE' | 'HTTP_ERROR' | 'TIMEOUT' | 'CANCELLED' | 'PROVIDER_ERROR',
    message: string,
  ) {
    super(message);
  }
}

interface StreamTutorOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function parseEvent(block: string) {
  let event = 'message';
  const data: string[] = [];
  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trim());
  });
  return { event, data: data.join('\n') };
}

export async function* streamTutor(
  rawRequest: TutorRequest,
  options: StreamTutorOptions = {},
): AsyncIterable<string> {
  const request = tutorRequestSchema.parse(rawRequest);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 20_000);
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });

  try {
    const response = await (options.fetcher ?? fetch)('/api/tutor/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new TutorClientError(
        'HTTP_ERROR',
        `Tutor request failed with HTTP ${response.status}.`,
      );
    }
    if (!response.body) {
      throw new TutorClientError('INVALID_RESPONSE', 'Tutor returned an empty response.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        const event = parseEvent(block);
        if (!event.data) continue;
        const payload = JSON.parse(event.data) as {
          text?: unknown;
          code?: unknown;
          message?: unknown;
        };
        if (event.event === 'token' && typeof payload.text === 'string') yield payload.text;
        if (event.event === 'error') {
          const code = payload.code === 'TIMEOUT' ? 'TIMEOUT' : 'PROVIDER_ERROR';
          throw new TutorClientError(
            code,
            typeof payload.message === 'string' ? payload.message : 'Tutor 暂时不可用。',
          );
        }
        if (event.event === 'done') return;
      }
      if (done) break;
    }
  } catch (error) {
    if (error instanceof TutorClientError) throw error;
    if (timedOut) throw new TutorClientError('TIMEOUT', 'Tutor 响应超时，请稍后重试。');
    if (controller.signal.aborted)
      throw new TutorClientError('CANCELLED', '已停止本次 Tutor 回答。');
    throw new TutorClientError('PROVIDER_ERROR', 'Tutor 暂时不可用，离线学习功能不受影响。');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}
