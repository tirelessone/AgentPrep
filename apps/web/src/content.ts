import type { QuestionPrompt, QuestionReveal } from '@agentprep/domain';
import {
  publishedQuestionManifestSchema,
  type MultipleChoiceQuestion,
} from '@agentprep/question-schema';

import originalManifest from '../../../content/manifests/original-v1.json';

export const questionManifest = publishedQuestionManifestSchema.parse(originalManifest);

const questionsById = new Map(
  questionManifest.questions.map((question) => [question.id, question] as const),
);

export function toQuestionPrompt(question: MultipleChoiceQuestion): QuestionPrompt {
  return {
    id: question.id,
    version: question.version,
    prompt: question.prompt,
    choices: question.choices,
    topics: question.topics,
    difficulty: question.difficulty,
  };
}

export const questionPrompts = questionManifest.questions.map(toQuestionPrompt);

export function revealQuestion(questionId: string): QuestionReveal {
  const question = questionsById.get(questionId);
  if (!question) {
    throw new Error(`Unknown question: ${questionId}`);
  }

  return {
    correctChoiceIds: question.correctChoiceIds,
    explanation: question.explanation,
  };
}
