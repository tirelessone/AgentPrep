export interface LocalSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface QuestionChoice {
  id: string;
  text: string;
}

export interface QuestionPrompt {
  id: string;
  version: string;
  prompt: string;
  choices: readonly QuestionChoice[];
  topics: readonly string[];
  difficulty: 'foundation' | 'intermediate' | 'advanced';
}

export interface QuestionReveal {
  correctChoiceIds: readonly string[];
  explanation: string;
}

export interface StudyAttempt {
  id: string;
  questionId: string;
  questionVersion: string;
  attemptedAt: string;
  selectedChoiceIds: readonly string[];
  correct: boolean;
}

export interface FavoriteQuestion {
  questionId: string;
  createdAt: string;
}

export interface ReviewItem {
  questionId: string;
  dueAt: string;
  intervalDays: number;
  streak: number;
  updatedAt: string;
}
