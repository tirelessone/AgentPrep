import { z } from 'zod';

export const reviewStatusSchema = z.enum(['unverified', 'reviewed', 'rejected']);

export const provenanceSchema = z
  .object({
    kind: z.enum(['original', 'licensed_external', 'ai_generated']),
    source: z.string().min(1),
    sourceVersion: z.string().min(1),
    license: z.string().min(1),
    transform: z.string().min(1),
    reviewStatus: reviewStatusSchema,
  })
  .superRefine((value, context) => {
    if (value.kind === 'ai_generated' && value.reviewStatus !== 'unverified') {
      context.addIssue({
        code: 'custom',
        path: ['reviewStatus'],
        message: 'AI-generated questions must enter the system as unverified.',
      });
    }
  });

export const multipleChoiceQuestionSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    type: z.literal('multiple_choice'),
    prompt: z.string().min(1),
    topics: z.array(z.string().min(1)).min(1),
    difficulty: z.enum(['foundation', 'intermediate', 'advanced']),
    choices: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string().min(1),
        }),
      )
      .min(2),
    correctChoiceIds: z.array(z.string().min(1)).min(1).readonly(),
    explanation: z.string().min(1),
    provenance: provenanceSchema,
  })
  .superRefine((question, context) => {
    const choiceIds = question.choices.map((choice) => choice.id);
    const uniqueChoiceIds = new Set(choiceIds);
    if (uniqueChoiceIds.size !== choiceIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'Choice ids must be unique.',
      });
    }

    for (const correctId of question.correctChoiceIds) {
      if (!uniqueChoiceIds.has(correctId)) {
        context.addIssue({
          code: 'custom',
          path: ['correctChoiceIds'],
          message: `Unknown correct choice id: ${correctId}`,
        });
      }
    }
  });

export const questionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  manifestId: z.string().min(1),
  contentVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  review: z
    .object({
      reviewer: z.string().min(1),
      reviewedAt: z.iso.datetime(),
      licenseEvidence: z.string().min(1),
    })
    .optional(),
  questions: z.array(multipleChoiceQuestionSchema),
});

export const publishedQuestionManifestSchema = questionManifestSchema.superRefine(
  (manifest, context) => {
    const ids = new Set<string>();
    manifest.questions.forEach((question, index) => {
      if (ids.has(question.id)) {
        context.addIssue({
          code: 'custom',
          path: ['questions', index, 'id'],
          message: `Duplicate question id: ${question.id}`,
        });
      }
      ids.add(question.id);

      if (question.provenance.reviewStatus !== 'reviewed') {
        context.addIssue({
          code: 'custom',
          path: ['questions', index, 'provenance', 'reviewStatus'],
          message: 'Published manifests may contain reviewed questions only.',
        });
      }
    });
  },
);

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
export type QuestionManifest = z.infer<typeof questionManifestSchema>;
