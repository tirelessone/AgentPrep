import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    service: 'agentprep-server',
    status: 'ok',
  }));

  return app;
}
