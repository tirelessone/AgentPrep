import { questionMediaSchema, type QuestionMedia } from '@agentprep/question-schema';
import { z } from 'zod';

const sourceSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Asset source must be a lowercase URL-safe slug.');

function sourceFileName(sourceImagePath: string) {
  const trimmed = sourceImagePath.trim();
  if (!trimmed || /^(?:[a-zA-Z]:[\\/]|[\\/]{1,2})/.test(trimmed)) {
    throw new Error('Source image path must be a non-empty relative path.');
  }

  const segments = trimmed.replaceAll('\\', '/').split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Source image path must not contain empty or traversal segments.');
  }

  const fileName = segments.at(-1)!;
  if (fileName.includes('?') || fileName.includes('#')) {
    throw new Error('Source image file name must not contain a query or fragment.');
  }
  return fileName;
}

export function questionAssetPath(source: string, sourceImagePath: string) {
  const sourceSlug = sourceSlugSchema.parse(source);
  return `/question-assets/${sourceSlug}/${sourceFileName(sourceImagePath)}`;
}

export function imageMediaFromSource({
  source,
  sourceImagePath,
  alt,
}: {
  source: string;
  sourceImagePath: string;
  alt: string;
}): QuestionMedia {
  return questionMediaSchema.parse({
    type: 'image',
    src: questionAssetPath(source, sourceImagePath),
    alt,
  });
}
