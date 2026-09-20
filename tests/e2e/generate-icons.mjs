import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicDirectory = path.join(repositoryRoot, 'apps/web/public');
const svg = await readFile(path.join(publicDirectory, 'icon.svg'), 'utf8');
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const browser = await chromium.launch();

try {
  for (const [size, name] of [
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
    [180, 'apple-touch-icon.png'],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img src="${source}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    await page.screenshot({ path: path.join(publicDirectory, name) });
  }
} finally {
  await browser.close();
}
