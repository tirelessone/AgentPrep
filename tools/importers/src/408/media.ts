import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { questionMediaSchema, type QuestionMedia } from '@agentprep/question-schema';

const markdownImagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export interface ImageReference {
  alt: string;
  sourcePath: string;
}

export function extractMarkdownImages(text: string) {
  const references: ImageReference[] = [];
  const textWithoutImages = text.replace(
    markdownImagePattern,
    (_match, alt: string, sourcePath: string) => {
      references.push({ alt: alt.trim(), sourcePath });
      return '';
    },
  );
  return { text: textWithoutImages.trim(), references };
}

function normalizeRelativeSourcePath(sourcePath: string) {
  const normalized = sourcePath.trim().replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (
    !normalized ||
    path.posix.isAbsolute(normalized) ||
    /^[a-zA-Z]:\//.test(normalized) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(`Invalid source image path: ${sourcePath}`);
  }
  return normalized;
}

export function stable408AssetName(sourcePath: string) {
  const normalized = normalizeRelativeSourcePath(sourcePath);
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  const safeBaseName = path.posix.basename(normalized).replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${digest}-${safeBaseName}`;
}

function resolveSourceAsset(sourceRoot: string, sourcePath: string) {
  const normalized = normalizeRelativeSourcePath(sourcePath);
  const root = path.resolve(sourceRoot);
  const resolved = path.resolve(root, ...normalized.split('/'));
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Source image escapes source root: ${sourcePath}`);
  }
  return { normalized, resolved };
}

export interface MaterializedPromptMedia {
  media: readonly QuestionMedia[];
  assetNames: readonly string[];
}

export async function materialize408PromptMedia({
  references,
  sourceRoot,
  assetOutput,
}: {
  references: readonly ImageReference[];
  sourceRoot: string;
  assetOutput: string;
}): Promise<MaterializedPromptMedia> {
  const prepared = await Promise.all(
    references.map(async (reference) => {
      const source = resolveSourceAsset(sourceRoot, reference.sourcePath);
      const bytes = await readFile(source.resolved);
      const assetName = stable408AssetName(source.normalized);
      return { reference, bytes, assetName };
    }),
  );

  await mkdir(assetOutput, { recursive: true });
  for (const item of prepared) {
    const destination = path.join(assetOutput, item.assetName);
    const existing = await readFile(destination).catch(() => undefined);
    if (existing && !existing.equals(item.bytes)) {
      throw new Error(`Asset collision with different content: ${item.assetName}`);
    }
    if (!existing) await writeFile(destination, item.bytes, { flag: 'wx' });
  }

  return {
    media: prepared.map((item) =>
      questionMediaSchema.parse({
        type: 'image',
        src: `/question-assets/408/${item.assetName}`,
        alt: item.reference.alt || '计算机网络题目配图',
      }),
    ),
    assetNames: prepared.map((item) => item.assetName),
  };
}
