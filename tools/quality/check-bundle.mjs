import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';

const assetsDirectory = path.resolve('apps/web/dist/assets');
const javascriptFiles = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'));
if (javascriptFiles.length === 0)
  throw new Error('No built JavaScript assets found. Run pnpm build first.');

let totalGzipBytes = 0;
for (const file of javascriptFiles) {
  totalGzipBytes += gzipSync(await readFile(path.join(assetsDirectory, file))).byteLength;
}

const budgetBytes = 180 * 1024;
const formatted = (totalGzipBytes / 1024).toFixed(1);
if (totalGzipBytes > budgetBytes) {
  throw new Error(`Web JavaScript gzip size ${formatted} KiB exceeds the 180 KiB budget.`);
}
process.stdout.write(`Web JavaScript gzip size: ${formatted} KiB / 180 KiB budget.\n`);
