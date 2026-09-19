import { useMemo, useState } from 'react';

import type { QuestionPrompt, QuestionSubject } from '@agentprep/domain';
import { getSubjectLabel } from '@agentprep/taxonomy';

import {
  getAvailableSubjectSummaries,
  getChapterSummaries,
  practiceModeCatalog,
  type PracticeMode,
  type PracticeSelectionValue,
} from './practice-selection';

export function PracticeSelection({
  questions,
  onBack,
  onStart,
}: {
  questions: readonly QuestionPrompt[];
  onBack: () => void;
  onStart: (selection: PracticeSelectionValue) => void;
}) {
  const subjects = useMemo(() => getAvailableSubjectSummaries(questions), [questions]);
  const [subject, setSubject] = useState<QuestionSubject>();
  const [chapter, setChapter] = useState('');
  const [mode, setMode] = useState<PracticeMode>('all');
  const chapters = useMemo(
    () => (subject ? getChapterSummaries(questions, subject) : []),
    [questions, subject],
  );
  const selectedChapter = chapters.find((item) => item.id === chapter);
  const subjectCount = subjects.find((item) => item.id === subject)?.questionCount ?? 0;
  const selectedCount = selectedChapter?.questionCount ?? subjectCount;

  return (
    <section className="practice-selection" aria-labelledby="practice-selection-title">
      <header className="selection-heading">
        <div>
          <p className="overline">FOCUSED PRACTICE</p>
          <h2 id="practice-selection-title">选择专项练习</h2>
          <p>先选学科和章节，再决定练习范围。题目和学习记录仍保存在当前设备。</p>
        </div>
        <button className="text-button" onClick={onBack}>
          返回首页
        </button>
      </header>

      <section aria-labelledby="subject-title">
        <h3 id="subject-title">1. 选择学科</h3>
        <div className="subject-grid">
          {subjects.map((item) => (
            <button
              key={item.id}
              className={subject === item.id ? 'selected' : ''}
              aria-pressed={subject === item.id}
              onClick={() => {
                setSubject(item.id);
                setChapter('');
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.questionCount} 道题</span>
            </button>
          ))}
        </div>
      </section>

      {subject && (
        <section className="selection-options" aria-labelledby="scope-title">
          <h3 id="scope-title">2. 选择范围</h3>
          <label>
            {getSubjectLabel(subject)}章节
            <select value={chapter} onChange={(event) => setChapter(event.target.value)}>
              <option value="">全部章节（{subjectCount} 道题）</option>
              {chapters.map((item) => (
                <option key={item.id} value={item.id} disabled={item.questionCount === 0}>
                  {item.label}（{item.questionCount} 道题）
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>3. 选择模式</legend>
            <div className="mode-grid">
              {practiceModeCatalog.map((item) => (
                <label key={item.id} className={mode === item.id ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="practice-mode"
                    value={item.id}
                    checked={mode === item.id}
                    onChange={() => setMode(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            className="primary-button full-width"
            disabled={selectedCount === 0}
            onClick={() => onStart({ subject, chapter: chapter || undefined, mode })}
          >
            开始专项练习 <span>→</span>
          </button>
        </section>
      )}
    </section>
  );
}
