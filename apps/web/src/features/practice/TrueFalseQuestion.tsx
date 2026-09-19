import type {
  QuestionResponse,
  TrueFalseQuestionPrompt,
  TrueFalseQuestionReveal,
} from '@agentprep/domain';

import { QuestionMedia } from './QuestionMedia';

const answers = [
  { value: true, label: '正确' },
  { value: false, label: '错误' },
] as const;

export function TrueFalseQuestion({
  disabled,
  question,
  response,
  reveal,
  onChange,
}: {
  disabled: boolean;
  question: TrueFalseQuestionPrompt;
  response?: Extract<QuestionResponse, { type: 'true_false' }> | undefined;
  reveal?: TrueFalseQuestionReveal | undefined;
  onChange: (response: Extract<QuestionResponse, { type: 'true_false' }>) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>{question.prompt}</legend>
      <QuestionMedia media={question.media} />
      <p className="question-hint">判断题</p>
      <div className="choices true-false-choices">
        {answers.map((option) => {
          const checked = response?.answer === option.value;
          const isCorrect = reveal?.answer === option.value;
          const isWrongSelection = Boolean(reveal && checked && !isCorrect);
          return (
            <label
              key={String(option.value)}
              className={[
                'choice',
                checked ? 'selected' : '',
                reveal && isCorrect ? 'correct' : '',
                isWrongSelection ? 'wrong' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name={`answer-${question.id}`}
                aria-label={option.label}
                checked={checked}
                onChange={() => onChange({ type: 'true_false', answer: option.value })}
              />
              <span className="choice-key">{option.value ? '✓' : '✕'}</span>
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
