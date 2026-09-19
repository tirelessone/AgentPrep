import { z } from 'zod';

import {
  difficultySchema,
  importanceSchema,
  isCanonicalChapter,
  subjectSchema,
} from '@agentprep/taxonomy';

export { difficultySchema, importanceSchema, subjectSchema } from '@agentprep/taxonomy';
export type { Difficulty, Importance, Subject } from '@agentprep/taxonomy';

const nonEmptyStringSchema = z.string().trim().min(1);
export const reviewStatusSchema = z.enum(['unverified', 'reviewed', 'rejected']);

export const provenanceSchema = z
  .object({
    kind: z.enum(['original', 'licensed_external', 'ai_generated']),
    source: nonEmptyStringSchema,
    sourceVersion: nonEmptyStringSchema,
    license: nonEmptyStringSchema,
    transform: nonEmptyStringSchema,
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

export const questionChoiceSchema = z.object({
  id: nonEmptyStringSchema,
  text: nonEmptyStringSchema,
});

const questionBaseSchema = z.object({
  id: nonEmptyStringSchema,
  version: nonEmptyStringSchema,
  prompt: nonEmptyStringSchema,
  subject: subjectSchema,
  chapter: nonEmptyStringSchema,
  knowledgePoints: z.array(nonEmptyStringSchema).min(1),
  difficulty: difficultySchema,
  importance: importanceSchema,
  provenance: provenanceSchema,
});

const choiceQuestionBaseSchema = questionBaseSchema.extend({
  choices: z.array(questionChoiceSchema).min(2),
  explanation: nonEmptyStringSchema,
});

function validateChoices(
  question: { choices: readonly { id: string }[] },
  correctChoiceIds: readonly string[],
  context: z.RefinementCtx,
) {
  const choiceIds = question.choices.map((choice) => choice.id);
  const uniqueChoiceIds = new Set(choiceIds);
  if (uniqueChoiceIds.size !== choiceIds.length) {
    context.addIssue({
      code: 'custom',
      path: ['choices'],
      message: 'Choice ids must be unique.',
    });
  }

  if (new Set(correctChoiceIds).size !== correctChoiceIds.length) {
    context.addIssue({
      code: 'custom',
      path: ['correctChoiceIds'],
      message: 'Correct choice ids must be unique.',
    });
  }

  correctChoiceIds.forEach((correctId) => {
    if (!uniqueChoiceIds.has(correctId)) {
      context.addIssue({
        code: 'custom',
        path: ['correctChoiceIds'],
        message: `Unknown correct choice id: ${correctId}`,
      });
    }
  });
}

export const singleChoiceQuestionSchema = choiceQuestionBaseSchema
  .extend({
    type: z.literal('single_choice'),
    correctChoiceId: nonEmptyStringSchema,
  })
  .superRefine((question, context) => {
    validateChoices(question, [question.correctChoiceId], context);
  });

export const multipleChoiceQuestionSchema = choiceQuestionBaseSchema
  .extend({
    type: z.literal('multiple_choice'),
    correctChoiceIds: z.array(nonEmptyStringSchema).min(2).readonly(),
  })
  .superRefine((question, context) => {
    validateChoices(question, question.correctChoiceIds, context);
  });

export const trueFalseQuestionSchema = questionBaseSchema.extend({
  type: z.literal('true_false'),
  answer: z.boolean(),
  explanation: nonEmptyStringSchema,
});

export const oralQuestionSchema = questionBaseSchema.extend({
  type: z.literal('oral'),
  referenceAnswer: nonEmptyStringSchema,
  keyPoints: z.array(nonEmptyStringSchema).min(1).readonly(),
  followUps: z.array(nonEmptyStringSchema).readonly(),
});

export const questionSchema = z.discriminatedUnion('type', [
  singleChoiceQuestionSchema,
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema,
  oralQuestionSchema,
]);

export const questionManifestSchema = z.object({
  schemaVersion: z.literal(2),
  manifestId: nonEmptyStringSchema,
  contentVersion: nonEmptyStringSchema,
  generatedAt: z.iso.datetime(),
  review: z
    .object({
      reviewer: nonEmptyStringSchema,
      reviewedAt: z.iso.datetime(),
      licenseEvidence: nonEmptyStringSchema,
    })
    .optional(),
  questions: z.array(questionSchema).min(1),
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

      if (!isCanonicalChapter(question.subject, question.chapter)) {
        context.addIssue({
          code: 'custom',
          path: ['questions', index, 'chapter'],
          message: `Unknown chapter for ${question.subject}: ${question.chapter}`,
        });
      }
    });
  },
);

export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type QuestionChoice = z.infer<typeof questionChoiceSchema>;
export type SingleChoiceQuestion = z.infer<typeof singleChoiceQuestionSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
export type TrueFalseQuestion = z.infer<typeof trueFalseQuestionSchema>;
export type OralQuestion = z.infer<typeof oralQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionManifest = z.infer<typeof questionManifestSchema>;
