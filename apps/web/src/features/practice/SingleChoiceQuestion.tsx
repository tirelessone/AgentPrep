import type {
  QuestionResponse,
  SingleChoiceQuestionPrompt,
  SingleChoiceQuestionReveal,
} from '@agentprep/domain';

export function SingleChoiceQuestion({
  disabled,
  question,
  response,
  reveal,
  onChange,
}: {
  disabled: boolean;
  question: SingleChoiceQuestionPrompt;
  response?: Extract<QuestionResponse, { type: 'single_choice' }> | undefined;
  reveal?: SingleChoiceQuestionReveal | undefined;
  onChange: (response: Extract<QuestionResponse, { type: 'single_choice' }>) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>{question.prompt}</legend>
      <div className="choices">
        {question.choices.map((choice, choiceIndex) => {
          const checked = response?.selectedChoiceId === choice.id;
          const isCorrect = reveal?.correctChoiceId === choice.id;
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
                type="radio"
                name={`answer-${question.id}`}
                value={choice.id}
                aria-label={choice.text}
                checked={checked}
                onChange={() => onChange({ type: 'single_choice', selectedChoiceId: choice.id })}
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
