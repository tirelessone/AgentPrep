import type { QuestionPrompt, QuestionReveal } from '@agentprep/domain';
import {
  publishedQuestionManifestSchema,
  type Question,
  type QuestionManifest,
} from '@agentprep/question-schema';

export const publishedManifestUrls = [
  '/content/original-v2.json',
  '/content/408-network.json',
] as const;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}

function promptMetadata(question: Question) {
  return {
    id: question.id,
    version: question.version,
    prompt: question.prompt,
    subject: question.subject,
    chapter: question.chapter,
    knowledgePoints: question.knowledgePoints,
    difficulty: question.difficulty,
    importance: question.importance,
    ...(question.media !== undefined ? { media: question.media } : {}),
  };
}

export function toQuestionPrompt(question: Question): QuestionPrompt {
  const metadata = promptMetadata(question);
  switch (question.type) {
    case 'single_choice':
    case 'multiple_choice':
      return { ...metadata, type: question.type, choices: question.choices };
    case 'true_false':
      return { ...metadata, type: question.type };
    case 'oral':
      return { ...metadata, type: question.type };
  }
}

export function mergePublishedManifests(inputs: readonly unknown[]): QuestionManifest {
  const manifests = inputs.map((input) => publishedQuestionManifestSchema.parse(input));
  const ids = new Set<string>();
  const questions = manifests.flatMap((manifest) =>
    manifest.questions.map((question) => {
      if (ids.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
      ids.add(question.id);
      return question;
    }),
  );
  const generatedAt = manifests
    .map((manifest) => manifest.generatedAt)
    .sort()
    .at(-1);

  return publishedQuestionManifestSchema.parse({
    schemaVersion: 2,
    manifestId: 'agentprep-published-content',
    contentVersion: manifests.map((manifest) => manifest.contentVersion).join('+'),
    generatedAt,
    questions,
  });
}

export interface QuestionContent {
  manifest: QuestionManifest;
  questionPrompts: readonly QuestionPrompt[];
  revealQuestion: (questionId: string) => QuestionReveal;
}

export function createQuestionContent(input: unknown): QuestionContent {
  const manifest = deepFreeze(publishedQuestionManifestSchema.parse(input));
  const questionsById = new Map(manifest.questions.map((question) => [question.id, question]));

  return {
    manifest,
    questionPrompts: manifest.questions.map(toQuestionPrompt),
    revealQuestion(questionId) {
      const question = questionsById.get(questionId);
      if (!question) throw new Error(`Unknown question: ${questionId}`);

      switch (question.type) {
        case 'single_choice':
          return {
            type: question.type,
            correctChoiceId: question.correctChoiceId,
            explanation: question.explanation,
          };
        case 'multiple_choice':
          return {
            type: question.type,
            correctChoiceIds: question.correctChoiceIds,
            explanation: question.explanation,
          };
        case 'true_false':
          return {
            type: question.type,
            answer: question.answer,
            explanation: question.explanation,
          };
        case 'oral':
          return {
            type: question.type,
            referenceAnswer: question.referenceAnswer,
            keyPoints: question.keyPoints,
            followUps: question.followUps,
          };
      }
    },
  };
}

export async function loadQuestionContent(fetcher: typeof fetch = fetch): Promise<QuestionContent> {
  const manifests = await Promise.all(
    publishedManifestUrls.map(async (url) => {
      const response = await fetcher(url);
      if (!response.ok) throw new Error(`Failed to load question manifest: ${url}`);
      const payload: unknown = await response.json();
      return payload;
    }),
  );
  return createQuestionContent(mergePublishedManifests(manifests));
}
