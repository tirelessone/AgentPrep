import type { QuestionPrompt, QuestionSubject } from '@agentprep/domain';
import { getChapters, subjectCatalog } from '@agentprep/taxonomy';

import type { AgentPrepDatabase } from '../../db';

export type PracticeMode = 'all' | 'unattempted' | 'wrong' | 'favorite';
export type PracticeQuestionCount = 20 | 50 | 'all';
export type PracticeOrder = 'random' | 'sequential';

export interface PracticeSelectionValue {
  subject: QuestionSubject;
  chapter?: string | undefined;
  mode: PracticeMode;
  count: PracticeQuestionCount;
  order: PracticeOrder;
}

export const practiceModeCatalog = [
  { id: 'all', label: '全部题目' },
  { id: 'unattempted', label: '未做题' },
  { id: 'wrong', label: '错题' },
  { id: 'favorite', label: '收藏' },
] as const satisfies readonly { id: PracticeMode; label: string }[];

export const practiceQuestionCountCatalog = [
  { id: 20, label: '20' },
  { id: 50, label: '50' },
  { id: 'all', label: '全部' },
] as const satisfies readonly { id: PracticeQuestionCount; label: string }[];

export const practiceOrderCatalog = [
  { id: 'random', label: '随机' },
  { id: 'sequential', label: '顺序' },
] as const satisfies readonly { id: PracticeOrder; label: string }[];

export function getPracticeModeLabel(mode: PracticeMode) {
  return practiceModeCatalog.find((item) => item.id === mode)!.label;
}

export function getAvailableSubjectSummaries(questions: readonly QuestionPrompt[]) {
  const counts = new Map<QuestionSubject, number>();
  questions.forEach((question) =>
    counts.set(question.subject, (counts.get(question.subject) ?? 0) + 1),
  );
  return subjectCatalog
    .map((subject) => ({ ...subject, questionCount: counts.get(subject.id) ?? 0 }))
    .filter((subject) => subject.questionCount > 0);
}

export function getChapterSummaries(
  questions: readonly QuestionPrompt[],
  subject: QuestionSubject,
) {
  const counts = new Map<string, number>();
  questions.forEach((question) => {
    if (question.subject === subject) {
      counts.set(question.chapter, (counts.get(question.chapter) ?? 0) + 1);
    }
  });
  return getChapters(subject).map((chapter) => ({
    ...chapter,
    questionCount: counts.get(chapter.id) ?? 0,
  }));
}

export function filterQuestionsByTaxonomy(
  questions: readonly QuestionPrompt[],
  selection: Pick<PracticeSelectionValue, 'subject' | 'chapter'>,
) {
  return questions.filter(
    (question) =>
      question.subject === selection.subject &&
      (!selection.chapter || question.chapter === selection.chapter),
  );
}

export async function selectPracticeQuestions(
  database: AgentPrepDatabase,
  questions: readonly QuestionPrompt[],
  selection: PracticeSelectionValue,
  random: () => number = Math.random,
) {
  const scopedQuestions = filterQuestionsByTaxonomy(questions, selection);
  if (scopedQuestions.length === 0) return [];
  let modeQuestions: readonly QuestionPrompt[] = scopedQuestions;

  if (selection.mode === 'unattempted') {
    const scopedIds = scopedQuestions.map((question) => question.id);
    const attemptedIds = new Set(
      (await database.attempts.where('questionId').anyOf(scopedIds).uniqueKeys()).map(String),
    );
    modeQuestions = scopedQuestions.filter((question) => !attemptedIds.has(question.id));
  } else if (selection.mode !== 'all') {
    const scopedIds = scopedQuestions.map((question) => question.id);
    let selectedIds: Set<string>;
    if (selection.mode === 'wrong') {
      const attempts = await database.attempts.where('questionId').anyOf(scopedIds).toArray();
      const latestAttempts = new Map<string, (typeof attempts)[number]>();
      attempts.forEach((attempt) => {
        const current = latestAttempts.get(attempt.questionId);
        if (!current || current.attemptedAt < attempt.attemptedAt) {
          latestAttempts.set(attempt.questionId, attempt);
        }
      });
      selectedIds = new Set(
        [...latestAttempts.values()]
          .filter((attempt) => !attempt.correct)
          .map((attempt) => attempt.questionId),
      );
    } else {
      selectedIds = new Set(
        (await database.favorites.where('questionId').anyOf(scopedIds).primaryKeys()).map(String),
      );
    }
    modeQuestions = scopedQuestions.filter((question) => selectedIds.has(question.id));
  }

  const orderedQuestions =
    selection.order === 'random' ? shuffleQuestions(modeQuestions, random) : [...modeQuestions];
  return selection.count === 'all' ? orderedQuestions : orderedQuestions.slice(0, selection.count);
}

export function shuffleQuestions(
  questions: readonly QuestionPrompt[],
  random: () => number = Math.random,
) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}
