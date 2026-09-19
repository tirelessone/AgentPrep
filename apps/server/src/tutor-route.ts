import type { FastifyInstance } from 'fastify';

import { tutorRequestSchema, type TutorProvider } from '@agentprep/tutor-core';

interface TutorRouteOptions {
  bodyLimitBytes: number;
  provider: TutorProvider;
  rateLimit: {
    max: number;
    timeWindow: number;
  };
  timeoutMs: number;
}

function writeEvent(
  raw: NodeJS.WritableStream,
  event: 'meta' | 'token' | 'done' | 'error',
  data: object,
) {
  raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function registerTutorRoute(app: FastifyInstance, options: TutorRouteOptions) {
  app.post(
    '/api/tutor/stream',
    {
      bodyLimit: options.bodyLimitBytes,
      config: { rateLimit: options.rateLimit },
    },
    async (request, reply) => {
      const parsed = tutorRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'INVALID_REQUEST',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        });
      }

      reply.hijack();
      reply.raw.statusCode = 200;
      reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('cache-control', 'no-cache, no-transform');
      reply.raw.setHeader('connection', 'keep-alive');
      reply.raw.flushHeaders();

      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error('Tutor timeout'));
      }, options.timeoutMs);
      reply.raw.once('close', () => {
        if (!reply.raw.writableEnded) controller.abort(new Error('Client disconnected'));
      });

      try {
        writeEvent(reply.raw, 'meta', { requestId: crypto.randomUUID(), mode: parsed.data.mode });
        for await (const chunk of options.provider.stream(parsed.data, controller.signal)) {
          if (controller.signal.aborted) break;
          writeEvent(reply.raw, 'token', { text: chunk.text });
        }
        if (!controller.signal.aborted) writeEvent(reply.raw, 'done', {});
      } catch {
        if (!reply.raw.writableEnded) {
          writeEvent(reply.raw, 'error', {
            code: timedOut ? 'TIMEOUT' : 'PROVIDER_ERROR',
            message: timedOut
              ? 'Tutor 响应超时，请稍后重试。'
              : 'Tutor 暂时不可用，离线学习功能不受影响。',
          });
        }
      } finally {
        clearTimeout(timeout);
        if (!reply.raw.writableEnded) reply.raw.end();
      }
    },
  );
}
