import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { import408Network } from '../408/index.js';
import { readFlags } from './args.js';

const flags = readFlags(process.argv.slice(2));
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const resolveInput = (value: string) =>
  path.isAbsolute(value) ? value : path.resolve(repositoryRoot, value);
const inputPath = resolveInput(flags.require('input'));
const sourceRoot = resolveInput(flags.require('source-root'));
const outputPath = resolveInput(flags.require('output'));
const assetOutput = resolveInput(flags.require('asset-output'));
const sourceVersion = flags.require('source-version');

const result = await import408Network({
  inputText: await readFile(inputPath, 'utf8'),
  sourceRoot,
  assetOutput,
  sourceVersion,
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result.manifest, null, 2)}\n`, 'utf8');
const reportPath = path.join(path.dirname(outputPath), 'import-report.json');
await writeFile(reportPath, `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
process.stdout.write(
  `Imported ${result.report.imported} questions; skipped ${result.report.skipped}.\n` +
    `Manifest: ${outputPath}\nReport: ${reportPath}\n`,
);
