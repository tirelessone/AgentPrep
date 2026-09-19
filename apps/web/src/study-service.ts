import type {
  QuestionPrompt,
  QuestionResponse,
  QuestionReveal,
  ReviewItem,
  StudyAttempt,
} from '@agentprep/domain';

import type { AgentPrepDatabase } from './db';

const DAY_MS = 24 * 60 * 60 * 1000;

function sameChoices(selected: readonly string[], correct: readonly string[]) {
  if (selected.length !== correct.length || new Set(selected).size !== selected.length)
    return false;
  const selectedSet = new Set(selected);
  return correct.every((choiceId) => selectedSet.has(choiceId));
}

function evaluateResponse(
  prompt: QuestionPrompt,
  reveal: QuestionReveal,
  response: QuestionResponse,
) {
  if (prompt.type !== reveal.type || prompt.type !== response.type) {
    throw new Error('The response type does not match the question type.');
  }

  switch (prompt.type) {
    case 'single_choice': {
      if (reveal.type !== 'single_choice' || response.type !== 'single_choice')
        throw new Error('The single-choice response is invalid.');
      const allowed = new Set(prompt.choices.map((choice) => choice.id));
      if (!allowed.has(response.selectedChoiceId))
        throw new Error('The selected choice is not valid for this question.');
      return {
        correct: response.selectedChoiceId === reveal.correctChoiceId,
        selectedChoiceIds: [response.selectedChoiceId],
      };
    }
    case 'multiple_choice': {
      if (reveal.type !== 'multiple_choice' || response.type !== 'multiple_choice')
        throw new Error('The multiple-choice response is invalid.');
      const allowed = new Set(prompt.choices.map((choice) => choice.id));
      if (
        response.selectedChoiceIds.length === 0 ||
        new Set(response.selectedChoiceIds).size !== response.selectedChoiceIds.length ||
        response.selectedChoiceIds.some((choiceId) => !allowed.has(choiceId))
      ) {
        throw new Error('The selected choices are not valid for this question.');
      }
      return {
        correct: sameChoices(response.selectedChoiceIds, reveal.correctChoiceIds),
        selectedChoiceIds: [...response.selectedChoiceIds],
      };
    }
    case 'true_false':
      if (reveal.type !== 'true_false' || response.type !== 'true_false')
        throw new Error('The true/false response is invalid.');
      return { correct: response.answer === reveal.answer, selectedChoiceIds: [] };
    case 'oral':
      if (reveal.type !== 'oral' || response.type !== 'oral')
        throw new Error('The oral self-assessment is invalid.');
      return {
        correct: response.selfAssessment === 'understood',
        selectedChoiceIds: [],
      };
  }
}

export async function recordAttempt(
  database: AgentPrepDatabase,
  prompt: QuestionPrompt,
  reveal: QuestionReveal,
  response: QuestionResponse,
  now = new Date(),
) {
  const evaluation = evaluateResponse(prompt, reveal, response);
  const timestamp = now.toISOString();
  const attempt: StudyAttempt = {
    id: crypto.randomUUID(),
    questionId: prompt.id,
    questionVersion: prompt.version,
    attemptedAt: timestamp,
    selectedChoiceIds: evaluation.selectedChoiceIds,
    response,
    correct: evaluation.correct,
  };

  await database.transaction('rw', database.attempts, database.reviews, async () => {
    const currentReview = await database.reviews.get(prompt.id);
    const nextInterval = evaluation.correct
      ? Math.max(1, (currentReview?.intervalDays ?? 0) * 2 || 1)
      : 0;
    const review: ReviewItem = {
      questionId: prompt.id,
      dueAt: new Date(now.getTime() + nextInterval * DAY_MS).toISOString(),
      intervalDays: nextInterval,
      streak: evaluation.correct ? (currentReview?.streak ?? 0) + 1 : 0,
      updatedAt: timestamp,
    };

    await database.attempts.add(attempt);
    await database.reviews.put(review);
  });

  return attempt;
}

export async function toggleFavorite(
  database: AgentPrepDatabase,
  questionId: string,
  now = new Date(),
) {
  return database.transaction('rw', database.favorites, async () => {
    const existing = await database.favorites.get(questionId);
    if (existing) {
      await database.favorites.delete(questionId);
      return false;
    }

    await database.favorites.add({ questionId, createdAt: now.toISOString() });
    return true;
  });
}

export async function getLatestWrongQuestionIds(database: AgentPrepDatabase) {
  const attempts = await database.attempts.orderBy('attemptedAt').reverse().toArray();
  const latest = new Map<string, StudyAttempt>();
  attempts.forEach((attempt) => {
    if (!latest.has(attempt.questionId)) latest.set(attempt.questionId, attempt);
  });
  return [...latest.values()]
    .filter((attempt) => !attempt.correct)
    .map((attempt) => attempt.questionId);
}

export async function getDueReviewQuestionIds(database: AgentPrepDatabase, now = new Date()) {
  const due = await database.reviews.where('dueAt').belowOrEqual(now.toISOString()).sortBy('dueAt');
  return due.map((review) => review.questionId);
}
