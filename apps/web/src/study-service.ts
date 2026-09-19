import type { QuestionPrompt, QuestionReveal, ReviewItem, StudyAttempt } from '@agentprep/domain';

import type { AgentPrepDatabase } from './db';

const DAY_MS = 24 * 60 * 60 * 1000;

function sameChoices(selected: readonly string[], correct: readonly string[]) {
  if (selected.length !== correct.length) return false;
  const selectedSet = new Set(selected);
  return correct.every((choiceId) => selectedSet.has(choiceId));
}

export async function recordAttempt(
  database: AgentPrepDatabase,
  prompt: QuestionPrompt,
  reveal: QuestionReveal,
  selectedChoiceIds: readonly string[],
  now = new Date(),
) {
  const allowedChoiceIds = new Set(prompt.choices.map((choice) => choice.id));
  if (
    selectedChoiceIds.length === 0 ||
    selectedChoiceIds.some((choiceId) => !allowedChoiceIds.has(choiceId))
  ) {
    throw new Error('The selected choices are not valid for this question.');
  }

  const correct = sameChoices(selectedChoiceIds, reveal.correctChoiceIds);
  const timestamp = now.toISOString();
  const attempt: StudyAttempt = {
    id: crypto.randomUUID(),
    questionId: prompt.id,
    questionVersion: prompt.version,
    attemptedAt: timestamp,
    selectedChoiceIds: [...selectedChoiceIds],
    correct,
  };

  await database.transaction('rw', database.attempts, database.reviews, async () => {
    const currentReview = await database.reviews.get(prompt.id);
    const nextInterval = correct ? Math.max(1, (currentReview?.intervalDays ?? 0) * 2 || 1) : 0;
    const review: ReviewItem = {
      questionId: prompt.id,
      dueAt: new Date(now.getTime() + nextInterval * DAY_MS).toISOString(),
      intervalDays: nextInterval,
      streak: correct ? (currentReview?.streak ?? 0) + 1 : 0,
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
