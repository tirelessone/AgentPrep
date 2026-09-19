export interface LocalSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface StudyRecord {
  questionId: string;
  attemptedAt: string;
  selectedChoiceIds: readonly string[];
  correct: boolean;
}
