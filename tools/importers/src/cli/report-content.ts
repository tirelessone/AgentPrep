import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildProvenanceReport } from '../report.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestRoot = path.join(root, 'content', 'manifests');
const reportPath = path.join(root, 'content', 'PROVENANCE_REPORT.md');
const files = (await readdir(manifestRoot)).filter((file) => file.endsWith('.json')).sort();
const sources = await Promise.all(
  files.map(async (file) => ({
    file: `content/manifests/${file}`,
    text: await readFile(path.join(manifestRoot, file), 'utf8'),
  })),
);
const report = buildProvenanceReport(sources);

if (process.argv.includes('--write')) {
  await writeFile(reportPath, report, 'utf8');
  process.stdout.write(`Wrote ${reportPath}\n`);
} else if (process.argv.includes('--check')) {
  const existing = await readFile(reportPath, 'utf8').catch(() => '');
  if (existing !== report)
    throw new Error('Content provenance report is stale. Run pnpm content:report.');
  process.stdout.write('Content manifests and provenance report are valid.\n');
} else {
  process.stdout.write(report);
}
