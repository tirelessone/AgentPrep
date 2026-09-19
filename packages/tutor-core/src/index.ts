export const tutorModes = [
  'zero_base',
  'wrong_reason',
  'interview_scope',
  'socratic',
  'similar_question',
  'free_chat',
] as const;

export type TutorMode = (typeof tutorModes)[number];

export interface TutorPrompt {
  mode: TutorMode;
  message: string;
}

export interface TutorChunk {
  text: string;
}

export interface TutorProvider {
  stream(prompt: TutorPrompt, signal: AbortSignal): AsyncIterable<TutorChunk>;
}
