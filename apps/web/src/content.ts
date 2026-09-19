import type { QuestionPrompt, QuestionReveal } from '@agentprep/domain';
import { publishedQuestionManifestSchema, type Question } from '@agentprep/question-schema';

import originalManifest from '../../../content/manifests/original-v2.json';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}

export const questionManifest = deepFreeze(publishedQuestionManifestSchema.parse(originalManifest));

const questionsById = new Map(
  questionManifest.questions.map((question) => [question.id, question] as const),
);

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

export const questionPrompts = questionManifest.questions.map(toQuestionPrompt);

export function revealQuestion(questionId: string): QuestionReveal {
  const question = questionsById.get(questionId);
  if (!question) {
    throw new Error(`Unknown question: ${questionId}`);
  }

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
}
