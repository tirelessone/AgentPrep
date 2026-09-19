import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { approveManifest } from '../review.js';
import { readFlags } from './args.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const flags = readFlags(process.argv.slice(2));
const quarantineRoot = path.join(root, 'content', 'quarantine');
const manifestRoot = path.join(root, 'content', 'manifests');
const inputPath = path.resolve(quarantineRoot, flags.require('input'));
const outputPath = path.resolve(manifestRoot, flags.require('output'));
if (!inputPath.startsWith(`${quarantineRoot}${path.sep}`)) {
  throw new Error('Review input must be inside content/quarantine.');
}
if (!outputPath.startsWith(`${manifestRoot}${path.sep}`) || path.extname(outputPath) !== '.json') {
  throw new Error('Review output must be a JSON file inside content/manifests.');
}
if (existsSync(outputPath)) throw new Error(`Refusing to overwrite ${outputPath}.`);

const raw = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
const manifest = approveManifest(raw, {
  reviewer: flags.require('reviewer'),
  reviewedAt: new Date().toISOString(),
  licenseEvidence: flags.require('license-evidence'),
  contentVersion: flags.require('content-version'),
});
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(
  `Published ${manifest.questions.length} reviewed questions at ${outputPath}\n`,
);
