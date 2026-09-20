import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

export const upstream408QuestionSchema = z
  .object({
    id: nonEmptyString,
    book: nonEmptyString,
    chapter: z.number().int().positive(),
    chapter_title: z.string(),
    section: z.string(),
    section_title: z.string(),
    num: z.number().int().nonnegative(),
    type: nonEmptyString,
    question: z.string(),
    options: z.record(z.string(), z.string()),
    answer: z.array(z.string()),
    explanation: z.string(),
    source_file: nonEmptyString,
    source_pages: z.string().optional(),
    hidden: z.boolean().optional(),
    hidden_reason: z.string().optional(),
  })
  .passthrough();

export const upstream408FileSchema = z
  .object({
    version: z.union([z.string(), z.number()]),
    generated_at: z.iso.datetime({ offset: true }),
    total: z.number().int().nonnegative(),
    stats: z.unknown().optional(),
    questions: z.array(z.unknown()),
  })
  .passthrough();

export type Upstream408Question = z.infer<typeof upstream408QuestionSchema>;
