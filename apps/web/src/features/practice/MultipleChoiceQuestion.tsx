import type {
  MultipleChoiceQuestionPrompt,
  MultipleChoiceQuestionReveal,
  QuestionResponse,
} from '@agentprep/domain';

import { QuestionMedia } from './QuestionMedia';

export function MultipleChoiceQuestion({
  disabled,
  question,
  response,
  reveal,
  onChange,
}: {
  disabled: boolean;
  question: MultipleChoiceQuestionPrompt;
  response?: Extract<QuestionResponse, { type: 'multiple_choice' }> | undefined;
  reveal?: MultipleChoiceQuestionReveal | undefined;
  onChange: (response: Extract<QuestionResponse, { type: 'multiple_choice' }>) => void;
}) {
  const selected = response?.selectedChoiceIds ?? [];

  return (
    <fieldset disabled={disabled}>
      <legend>{question.prompt}</legend>
      <QuestionMedia media={question.media} />
      <p className="question-hint">多选题 · 可选择多个答案</p>
      <div className="choices">
        {question.choices.map((choice, choiceIndex) => {
          const checked = selected.includes(choice.id);
          const isCorrect = reveal?.correctChoiceIds.includes(choice.id);
          const isWrongSelection = Boolean(reveal && checked && !isCorrect);
          return (
            <label
              key={choice.id}
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
                type="checkbox"
                name={`answer-${question.id}`}
                value={choice.id}
                aria-label={choice.text}
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? selected.filter((selectedId) => selectedId !== choice.id)
                    : [...selected, choice.id];
                  onChange({ type: 'multiple_choice', selectedChoiceIds: next });
                }}
              />
              <span className="choice-key">{String.fromCharCode(65 + choiceIndex)}</span>
              <span>{choice.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
