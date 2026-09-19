export type QuestionSubject =
  | 'computer_network'
  | 'operating_system'
  | 'data_structure'
  | 'mysql'
  | 'llm'
  | 'agent'
  | 'machine_learning';

export type QuestionDifficulty = 'foundation' | 'intermediate' | 'advanced';
export type QuestionImportance = 1 | 2 | 3 | 4 | 5;

export interface LocalSetting {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface QuestionChoice {
  id: string;
  text: string;
}

interface QuestionPromptBase {
  id: string;
  version: string;
  prompt: string;
  subject: QuestionSubject;
  chapter: string;
  knowledgePoints: readonly string[];
  difficulty: QuestionDifficulty;
  importance: QuestionImportance;
}

export interface SingleChoiceQuestionPrompt extends QuestionPromptBase {
  type: 'single_choice';
  choices: readonly QuestionChoice[];
}

export interface MultipleChoiceQuestionPrompt extends QuestionPromptBase {
  type: 'multiple_choice';
  choices: readonly QuestionChoice[];
}

export interface TrueFalseQuestionPrompt extends QuestionPromptBase {
  type: 'true_false';
}

export interface OralQuestionPrompt extends QuestionPromptBase {
  type: 'oral';
}

export type ChoiceQuestionPrompt = SingleChoiceQuestionPrompt | MultipleChoiceQuestionPrompt;
export type QuestionPrompt = ChoiceQuestionPrompt | TrueFalseQuestionPrompt | OralQuestionPrompt;

export interface SingleChoiceQuestionReveal {
  type: 'single_choice';
  correctChoiceId: string;
  explanation: string;
}

export interface MultipleChoiceQuestionReveal {
  type: 'multiple_choice';
  correctChoiceIds: readonly string[];
  explanation: string;
}

export interface TrueFalseQuestionReveal {
  type: 'true_false';
  answer: boolean;
  explanation: string;
}

export interface OralQuestionReveal {
  type: 'oral';
  referenceAnswer: string;
  keyPoints: readonly string[];
  followUps: readonly string[];
}

export type ChoiceQuestionReveal = SingleChoiceQuestionReveal | MultipleChoiceQuestionReveal;
export type QuestionReveal = ChoiceQuestionReveal | TrueFalseQuestionReveal | OralQuestionReveal;

export type QuestionResponse =
  | { type: 'single_choice'; selectedChoiceId: string }
  | { type: 'multiple_choice'; selectedChoiceIds: readonly string[] }
  | { type: 'true_false'; answer: boolean }
  | { type: 'oral'; selfAssessment: 'understood' | 'needs_review' };

export interface StudyAttempt {
  id: string;
  questionId: string;
  questionVersion: string;
  attemptedAt: string;
  selectedChoiceIds: readonly string[];
  response?: QuestionResponse | undefined;
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
