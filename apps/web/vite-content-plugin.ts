import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { Plugin } from 'vite';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const contentAssets = [
  {
    url: '/content/original-v2.json',
    fileName: 'content/original-v2.json',
    source: path.join(repositoryRoot, 'content', 'manifests', 'original-v2.json'),
  },
  {
    url: '/content/408-network.json',
    fileName: 'content/408-network.json',
    source: path.join(repositoryRoot, 'content', 'external', '408', 'computer-network.json'),
  },
] as const;

export function questionContentPlugin(): Plugin {
  return {
    name: 'agentprep-question-content',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?', 1)[0];
        const asset = contentAssets.find((item) => item.url === pathname);
        if (!asset) return next();
        try {
          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(await readFile(asset.source));
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      for (const asset of contentAssets) {
        this.emitFile({
          type: 'asset',
          fileName: asset.fileName,
          source: await readFile(asset.source),
        });
      }
    },
  };
}
