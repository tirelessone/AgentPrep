import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distRoot = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repositoryRoot, 'apps/web/dist');

async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(root, entry.name);
      return entry.isDirectory() ? filesUnder(target) : [target];
    }),
  );
  return files.flat();
}

function relativeFiles(root, files) {
  return files.map((file) => path.relative(root, file).replaceAll('\\', '/')).sort();
}

async function digest(file) {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}

async function requireSameFile(source, bundled) {
  if ((await digest(source)) !== (await digest(bundled))) {
    throw new Error(`Bundled file differs from source: ${path.relative(repositoryRoot, bundled)}`);
  }
}

async function requireAbsent(relativePath) {
  try {
    await stat(path.join(distRoot, relativePath));
    throw new Error(`Desktop build unexpectedly contains ${relativePath}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}

const manifests = [
  {
    source: path.join(repositoryRoot, 'content/manifests/original-v2.json'),
    bundled: path.join(distRoot, 'content/original-v2.json'),
  },
  {
    source: path.join(repositoryRoot, 'content/external/408/computer-network.json'),
    bundled: path.join(distRoot, 'content/408-network.json'),
  },
];

let questionCount = 0;
for (const manifest of manifests) {
  await requireSameFile(manifest.source, manifest.bundled);
  const parsed = JSON.parse(await readFile(manifest.bundled, 'utf8'));
  if (!Array.isArray(parsed.questions)) throw new Error('Bundled question manifest is invalid.');
  questionCount += parsed.questions.length;
}

const sourceAssetsRoot = path.join(repositoryRoot, 'apps/web/public/question-assets');
const bundledAssetsRoot = path.join(distRoot, 'question-assets');
const sourceAssets = await filesUnder(sourceAssetsRoot);
const bundledAssets = await filesUnder(bundledAssetsRoot);
const sourceRelative = relativeFiles(sourceAssetsRoot, sourceAssets);
const bundledRelative = relativeFiles(bundledAssetsRoot, bundledAssets);

if (JSON.stringify(sourceRelative) !== JSON.stringify(bundledRelative)) {
  throw new Error('Desktop question asset set differs from apps/web/public/question-assets.');
}
for (const relativePath of sourceRelative) {
  await requireSameFile(
    path.join(sourceAssetsRoot, relativePath),
    path.join(bundledAssetsRoot, relativePath),
  );
}

await requireAbsent('sw.js');
await requireAbsent('manifest.webmanifest');
const allDistFiles = await filesUnder(distRoot);
const unexpectedPwaFiles = relativeFiles(distRoot, allDistFiles).filter(
  (file) => file.startsWith('workbox-') || file.includes('virtual_pwa-register'),
);
if (unexpectedPwaFiles.length > 0) {
  throw new Error(`Desktop build contains PWA runtime files: ${unexpectedPwaFiles.join(', ')}`);
}

const forbiddenPatterns = [
  /service[_-]?role/i,
  /SUPABASE_SERVICE_ROLE/i,
  /OPENAI_API_KEY/i,
  /postgres(?:ql)?:\/\//i,
];
const executableTextFiles = allDistFiles.filter(
  (file) => file.endsWith('.js') || file.endsWith('.html'),
);
for (const file of executableTextFiles) {
  const text = await readFile(file, 'utf8');
  if (forbiddenPatterns.some((pattern) => pattern.test(text))) {
    throw new Error(`Desktop executable asset contains a forbidden credential pattern: ${file}`);
  }
}

const javascriptFiles = allDistFiles.filter((file) => file.endsWith('.js'));
let javascriptBytes = 0;
let javascriptGzipBytes = 0;
for (const file of javascriptFiles) {
  const bytes = await readFile(file);
  javascriptBytes += bytes.length;
  javascriptGzipBytes += gzipSync(bytes).length;
}

process.stdout.write(
  JSON.stringify(
    {
      dist: path.relative(repositoryRoot, distRoot).replaceAll('\\', '/'),
      questionCount,
      questionAssetFiles: bundledAssets.length,
      pwaRuntimeFiles: 0,
      forbiddenCredentialPatterns: 0,
      javascriptFiles: javascriptFiles.length,
      javascriptBytes,
      javascriptGzipBytes,
    },
    null,
    2,
  ) + '\n',
);
