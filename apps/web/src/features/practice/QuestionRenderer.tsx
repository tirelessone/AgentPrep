import type { QuestionPrompt, QuestionResponse, QuestionReveal } from '@agentprep/domain';

import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { OralQuestion } from './OralQuestion';
import { SingleChoiceQuestion } from './SingleChoiceQuestion';
import { TrueFalseQuestion } from './TrueFalseQuestion';

export function QuestionRenderer({
  disabled,
  question,
  response,
  reveal,
  onChange,
}: {
  disabled: boolean;
  question: QuestionPrompt;
  response?: QuestionResponse | undefined;
  reveal?: QuestionReveal | undefined;
  onChange: (response: QuestionResponse) => void;
}) {
  switch (question.type) {
    case 'single_choice':
      return (
        <SingleChoiceQuestion
          disabled={disabled}
          question={question}
          response={response?.type === 'single_choice' ? response : undefined}
          reveal={reveal?.type === 'single_choice' ? reveal : undefined}
          onChange={onChange}
        />
      );
    case 'multiple_choice':
      return (
        <MultipleChoiceQuestion
          disabled={disabled}
          question={question}
          response={response?.type === 'multiple_choice' ? response : undefined}
          reveal={reveal?.type === 'multiple_choice' ? reveal : undefined}
          onChange={onChange}
        />
      );
    case 'true_false':
      return (
        <TrueFalseQuestion
          disabled={disabled}
          question={question}
          response={response?.type === 'true_false' ? response : undefined}
          reveal={reveal?.type === 'true_false' ? reveal : undefined}
          onChange={onChange}
        />
      );
    case 'oral':
      return <OralQuestion question={question} />;
  }
}
