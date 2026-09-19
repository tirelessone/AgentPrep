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

export const multipleChoiceQuestionSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  type: z.literal('multiple_choice'),
  prompt: z.string().min(1),
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
});

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
