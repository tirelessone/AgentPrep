import type { OralQuestionPrompt } from '@agentprep/domain';

import { QuestionMedia } from './QuestionMedia';

export function OralQuestion({ question }: { question: OralQuestionPrompt }) {
  return (
    <section className="oral-question" aria-labelledby={`oral-${question.id}`}>
      <h3 id={`oral-${question.id}`}>{question.prompt}</h3>
      <QuestionMedia media={question.media} />
      <p>请先独立口述答案。准备好后再查看参考答案，并根据掌握情况完成自评。</p>
    </section>
  );
}
