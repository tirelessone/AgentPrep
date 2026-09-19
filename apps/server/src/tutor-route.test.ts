import { afterEach, describe, expect, it } from 'vitest';

import { MockTutorProvider } from '@agentprep/tutor-core';

import { buildApp } from './app.js';

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('Tutor SSE route', () => {
  it('streams meta, token and done events from an injected provider', async () => {
    const app = buildApp({ provider: new MockTutorProvider(['one', 'two']) });
    apps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/api/tutor/stream',
      payload: { mode: 'free_chat', message: 'Explain agents.' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('event: meta');
    expect(response.body).toContain('data: {"text":"one"}');
    expect(response.body).toContain('data: {"text":"two"}');
    expect(response.body).toContain('event: done');
  });

  it('rejects invalid modes before starting a stream', async () => {
    const app = buildApp({ provider: new MockTutorProvider() });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/tutor/stream',
      payload: { mode: 'unknown', message: 'hello' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'INVALID_REQUEST' });
  });

  it('rejects oversized request bodies before invoking the provider', async () => {
    const app = buildApp({
      provider: new MockTutorProvider(),
      tutorBodyLimitBytes: 4_096,
    });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/tutor/stream',
      payload: { mode: 'free_chat', message: 'x'.repeat(5_000) },
    });

    expect(response.statusCode).toBe(413);
  });

  it('rate limits repeated Tutor requests from the same client', async () => {
    const app = buildApp({
      provider: new MockTutorProvider(['ok']),
      tutorRateLimitMax: 2,
      tutorRateLimitWindowMs: 60_000,
    });
    apps.push(app);
    const request = () =>
      app.inject({
        method: 'POST',
        url: '/api/tutor/stream',
        payload: { mode: 'free_chat', message: 'hello' },
      });

    expect((await request()).statusCode).toBe(200);
    expect((await request()).statusCode).toBe(200);
    const limited = await request();
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('emits a safe timeout event without exposing provider details', async () => {
    const app = buildApp({
      provider: new MockTutorProvider(['late'], 50),
      tutorTimeoutMs: 5,
    });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/tutor/stream',
      payload: { mode: 'free_chat', message: 'hello' },
    });
    expect(response.body).toContain('"code":"TIMEOUT"');
    expect(response.body).not.toContain('Tutor timeout');
  });

  it('degrades provider failures to a stable SSE error', async () => {
    const app = buildApp({ provider: new MockTutorProvider(['never'], 0, 0) });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/tutor/stream',
      payload: { mode: 'free_chat', message: 'hello' },
    });
    expect(response.body).toContain('"code":"PROVIDER_ERROR"');
    expect(response.body).toContain('离线学习功能不受影响');
    expect(response.body).not.toContain('Mock provider failure');
  });
});
