export * from './legacy-json.js';
export * from './report.js';
export * from './review.js';

export const importerPolicy = {
  outputDirectory: 'content/quarantine',
  defaultReviewStatus: 'unverified',
} as const;
