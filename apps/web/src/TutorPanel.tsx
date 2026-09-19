import { useRef, useState } from 'react';

import { tutorModes, type TutorMode } from '@agentprep/tutor-core';
import type { QuestionPrompt, QuestionReveal, StudyAttempt } from '@agentprep/domain';

import { streamTutor, TutorClientError } from './tutor-client';

const modeLabels: Record<TutorMode, string> = {
  zero_base: '零基础解释',
  wrong_reason: '错因分析',
  interview_scope: '面试口径',
  socratic: '苏格拉底引导',
  similar_question: '相似题',
  free_chat: '自由提问',
};

export function TutorPanel({
  prompt,
  reveal,
  attempt,
}: {
  prompt: QuestionPrompt;
  reveal: QuestionReveal;
  attempt: StudyAttempt;
}) {
  const [mode, setMode] = useState<TutorMode>(attempt.correct ? 'interview_scope' : 'wrong_reason');
  const [message, setMessage] = useState(
    attempt.correct ? '请给我一个面试口述版本。' : '请分析我为什么会选错。',
  );
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | undefined>(undefined);

  async function askTutor() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setAnswer('');
    setError('');
    setStatus('streaming');
    try {
      for await (const token of streamTutor(
        {
          mode,
          message,
          context: {
            submitted: true,
            questionId: prompt.id,
            prompt: prompt.prompt,
            choices: [...prompt.choices],
            selectedChoiceIds: [...attempt.selectedChoiceIds],
            correctChoiceIds: [...reveal.correctChoiceIds],
            explanation: reveal.explanation,
          },
        },
        { signal: controller.signal },
      )) {
        setAnswer((current) => current + token);
      }
      setStatus('done');
    } catch (reason) {
      const message =
        reason instanceof TutorClientError
          ? reason.message
          : 'Tutor 暂时不可用，离线学习功能不受影响。';
      setError(message);
      setStatus('error');
    } finally {
      controllerRef.current = undefined;
    }
  }

  return (
    <aside className="tutor-panel" aria-labelledby="tutor-title">
      <div className="tutor-heading">
        <div>
          <p className="overline">OPTIONAL · ONLINE</p>
          <h3 id="tutor-title">AI Tutor</h3>
        </div>
        {status === 'streaming' && <span className="streaming-dot">生成中</span>}
      </div>
      <label>
        辅导方式
        <select value={mode} onChange={(event) => setMode(event.target.value as TutorMode)}>
          {tutorModes.map((item) => (
            <option value={item} key={item}>
              {modeLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label>
        你想追问什么？
        <textarea
          value={message}
          maxLength={2_000}
          rows={3}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <div className="tutor-actions">
        <button
          className="secondary-button"
          disabled={!message.trim() || status === 'streaming'}
          onClick={() => void askTutor()}
        >
          询问 Tutor
        </button>
        {status === 'streaming' && (
          <button className="text-button" onClick={() => controllerRef.current?.abort()}>
            停止生成
          </button>
        )}
      </div>
      {answer && (
        <div className="tutor-answer" aria-live="polite">
          {answer}
        </div>
      )}
      {error && (
        <p className="tutor-error" role="alert">
          {error}
        </p>
      )}
      <small>AI 回答仅作辅导，不会修改题库标准答案。</small>
    </aside>
  );
}
