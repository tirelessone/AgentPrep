import {
  publishedQuestionManifestSchema,
  questionManifestSchema,
  type QuestionManifest,
} from '@agentprep/question-schema';

export interface ReviewOptions {
  reviewer: string;
  reviewedAt: string;
  licenseEvidence: string;
  contentVersion: string;
}

export function approveManifest(input: unknown, options: ReviewOptions): QuestionManifest {
  const manifest = questionManifestSchema.parse(input);
  if (manifest.questions.some((question) => question.provenance.kind === 'ai_generated')) {
    throw new Error('AI-generated questions cannot be promoted by the importer review command.');
  }

  return publishedQuestionManifestSchema.parse({
    ...manifest,
    contentVersion: options.contentVersion,
    generatedAt: options.reviewedAt,
    review: {
      reviewer: options.reviewer,
      reviewedAt: options.reviewedAt,
      licenseEvidence: options.licenseEvidence,
    },
    questions: manifest.questions.map((question) => ({
      ...question,
      provenance: {
        ...question.provenance,
        transform: `${question.provenance.transform}; human-review:${options.reviewer}`,
        reviewStatus: 'reviewed' as const,
      },
    })),
  });
}
