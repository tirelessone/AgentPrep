import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { importLegacyJson } from '../legacy-json.js';
import { readFlags } from './args.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const flags = readFlags(process.argv.slice(2));
const inputPath = path.resolve(flags.require('input'));
const quarantineRoot = path.join(root, 'content', 'quarantine');
const outputPath = path.resolve(quarantineRoot, flags.require('output'));
if (
  !outputPath.startsWith(`${quarantineRoot}${path.sep}`) ||
  path.extname(outputPath) !== '.json'
) {
  throw new Error('Importer output must be a JSON file inside content/quarantine.');
}
if (existsSync(outputPath)) throw new Error(`Refusing to overwrite ${outputPath}.`);

const sourceText = await readFile(inputPath, 'utf8');
const manifest = importLegacyJson(JSON.parse(sourceText) as unknown, {
  source: flags.require('source'),
  sourceVersion: flags.require('source-version'),
  license: flags.require('license'),
  manifestId: flags.require('manifest-id'),
  generatedAt: new Date().toISOString(),
});
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`Quarantined ${manifest.questions.length} questions at ${outputPath}\n`);
