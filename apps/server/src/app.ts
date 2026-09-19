import Fastify from 'fastify';

import type { TutorProvider } from '@agentprep/tutor-core';

import { createProviderFromEnv } from './openai-provider.js';
import { registerTutorRoute } from './tutor-route.js';

interface BuildAppOptions {
  provider?: TutorProvider;
  tutorTimeoutMs?: number;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    service: 'agentprep-server',
    status: 'ok',
  }));

  registerTutorRoute(app, {
    provider: options.provider ?? createProviderFromEnv(),
    timeoutMs: options.tutorTimeoutMs ?? 20_000,
  });

  return app;
}
