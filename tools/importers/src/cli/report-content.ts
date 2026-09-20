import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildProvenanceReport } from '../report.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const manifestRoot = path.join(root, 'content', 'manifests');
const externalRoot = path.join(root, 'content', 'external');
const reportPath = path.join(root, 'content', 'PROVENANCE_REPORT.md');

async function findJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findJsonFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'import-report.json'
        ? [entryPath]
        : [];
    }),
  );
  return files.flat();
}

const files = [
  ...(await findJsonFiles(manifestRoot)),
  ...(await findJsonFiles(externalRoot)),
].sort();
const sources = await Promise.all(
  files.map(async (file) => ({
    file: path.relative(root, file).replaceAll(path.sep, '/'),
    text: await readFile(file, 'utf8'),
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
