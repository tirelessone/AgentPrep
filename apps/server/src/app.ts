import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

import type { TutorProvider } from '@agentprep/tutor-core';

import { createProviderFromEnv } from './openai-provider.js';
import { registerTutorRoute } from './tutor-route.js';

interface BuildAppOptions {
  environment?: NodeJS.ProcessEnv;
  provider?: TutorProvider;
  tutorBodyLimitBytes?: number;
  tutorRateLimitMax?: number;
  tutorRateLimitWindowMs?: number;
  tutorTimeoutMs?: number;
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function buildApp(options: BuildAppOptions = {}) {
  const environment = options.environment ?? process.env;
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    service: 'agentprep-server',
    status: 'ok',
  }));

  app.register(async (tutorApp) => {
    await tutorApp.register(rateLimit, { global: false });
    registerTutorRoute(tutorApp, {
      bodyLimitBytes:
        options.tutorBodyLimitBytes ??
        readBoundedInteger(environment.TUTOR_BODY_LIMIT_BYTES, 65_536, 4_096, 262_144),
      provider: options.provider ?? createProviderFromEnv(environment),
      rateLimit: {
        max:
          options.tutorRateLimitMax ??
          readBoundedInteger(environment.TUTOR_RATE_LIMIT_MAX, 20, 1, 10_000),
        timeWindow:
          options.tutorRateLimitWindowMs ??
          readBoundedInteger(environment.TUTOR_RATE_LIMIT_WINDOW_MS, 60_000, 1_000, 3_600_000),
      },
      timeoutMs: options.tutorTimeoutMs ?? 20_000,
    });
  });

  return app;
}
