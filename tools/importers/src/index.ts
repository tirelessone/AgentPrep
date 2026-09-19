/**
 * Importers are intentionally empty in Phase 0.
 * Future importers must write unreviewed output to content/quarantine.
 */
export const importerPolicy = {
  outputDirectory: 'content/quarantine',
  defaultReviewStatus: 'unverified',
} as const;
