import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import process from 'node:process';

const assetsDirectory = path.resolve('apps/web/dist/assets');
const manifest = JSON.parse(
  await readFile(path.resolve('apps/web/dist/.vite/manifest.json'), 'utf8'),
);
const javascriptFiles = (await readdir(assetsDirectory)).filter((file) => file.endsWith('.js'));
if (javascriptFiles.length === 0)
  throw new Error('No built JavaScript assets found. Run pnpm build first.');

const gzipSizes = new Map();
for (const file of javascriptFiles) {
  gzipSizes.set(file, gzipSync(await readFile(path.join(assetsDirectory, file))).byteLength);
}

const entry = Object.values(manifest).find((item) => item.isEntry);
if (!entry) throw new Error('Unable to find the Web entry chunk in the Vite manifest.');
const eagerFiles = new Set();
function visit(item) {
  if (item.file.endsWith('.js')) eagerFiles.add(path.basename(item.file));
  for (const key of item.imports ?? []) visit(manifest[key]);
}
visit(entry);

const eagerGzipBytes = [...eagerFiles].reduce((sum, file) => sum + (gzipSizes.get(file) ?? 0), 0);
const totalGzipBytes = [...gzipSizes.values()].reduce((sum, size) => sum + size, 0);
const budgetBytes = 180 * 1024;
const eagerFormatted = (eagerGzipBytes / 1024).toFixed(1);
const totalFormatted = (totalGzipBytes / 1024).toFixed(1);
if (eagerGzipBytes > budgetBytes) {
  throw new Error(
    `Web eager JavaScript gzip size ${eagerFormatted} KiB exceeds the 180 KiB budget.`,
  );
}
process.stdout.write(
  `Web eager JavaScript gzip size: ${eagerFormatted} KiB / 180 KiB budget; ` +
    `all JavaScript including lazy cloud code: ${totalFormatted} KiB.\n`,
);
