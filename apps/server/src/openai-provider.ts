import { buildTutorMessages, type TutorProvider, type TutorRequest } from '@agentprep/tutor-core';

export interface OpenAICompatibleProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetcher?: typeof fetch;
}

function readContent(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const choices = Reflect.get(payload, 'choices');
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  if (!first || typeof first !== 'object') return undefined;
  const delta = Reflect.get(first, 'delta');
  if (!delta || typeof delta !== 'object') return undefined;
  const content = Reflect.get(delta, 'content');
  return typeof content === 'string' ? content : undefined;
}

export class OpenAICompatibleProvider implements TutorProvider {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: OpenAICompatibleProviderOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async *stream(request: TutorRequest, signal: AbortSignal) {
    const response = await this.fetcher(
      `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          stream: true,
          messages: buildTutorMessages(request),
        }),
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}.`);
    }
    if (!response.body) {
      throw new Error('Provider returned an empty stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');

          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          const content = readContent(JSON.parse(data) as unknown);
          if (content) yield { text: content };
        }

        if (done) break;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class UnavailableTutorProvider implements TutorProvider {
  async *stream() {
    throw new Error('Tutor provider is not configured.');
    yield { text: '' };
  }
}

export function createProviderFromEnv(environment: NodeJS.ProcessEnv = process.env): TutorProvider {
  const apiKey = environment.OPENAI_API_KEY;
  if (!apiKey) return new UnavailableTutorProvider();

  return new OpenAICompatibleProvider({
    apiKey,
    baseUrl: environment.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: environment.OPENAI_MODEL ?? 'gpt-4.1-mini',
  });
}
