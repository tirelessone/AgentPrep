import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import type { QuestionPrompt, QuestionReveal, StudyAttempt } from '@agentprep/domain';

import { exportStudyData, importStudyData } from './backup';
import { questionManifest, questionPrompts, revealQuestion } from './content';
import { db } from './db';
import { TutorPanel } from './TutorPanel';
import {
  getDueReviewQuestionIds,
  getLatestWrongQuestionIds,
  recordAttempt,
  toggleFavorite,
} from './study-service';

type View = 'home' | 'practice' | 'wrong' | 'favorites' | 'review' | 'data';

const viewLabels: Record<View, string> = {
  home: '首页',
  practice: '刷题',
  wrong: '错题',
  favorites: '收藏',
  review: '复习',
  data: '数据',
};

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function QuestionSession({
  questions,
  title,
  onExit,
}: {
  questions: readonly QuestionPrompt[];
  title: string;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ attempt: StudyAttempt; reveal: QuestionReveal }>();
  const question = questions[index];
  const favoriteIds = useLiveQuery(
    async () => (await db.favorites.toCollection().primaryKeys()).map(String),
    [],
    [] as string[],
  );
  const isFavorite = question ? favoriteIds.includes(question.id) : false;

  useEffect(() => {
    setIndex(0);
    setSelected([]);
    setResult(undefined);
  }, [questions]);

  if (!question) {
    return (
      <section className="empty-state" aria-labelledby="empty-title">
        <span aria-hidden="true">✓</span>
        <h2 id="empty-title">这里暂时没有题目</h2>
        <p>完成一些练习后，错题和到期复习会自动出现在这里。</p>
        <button className="primary-button" onClick={onExit}>
          返回首页
        </button>
      </section>
    );
  }

  async function submit() {
    if (selected.length === 0 || result) return;
    const reveal = revealQuestion(question!.id);
    const attempt = await recordAttempt(db, question!, reveal, selected);
    setResult({ attempt, reveal });
  }

  function next() {
    if (index + 1 >= questions.length) {
      onExit();
      return;
    }
    setIndex((current) => current + 1);
    setSelected([]);
    setResult(undefined);
  }

  return (
    <section className="session" aria-labelledby="session-title">
      <header className="session-header">
        <div>
          <p className="overline">{title}</p>
          <h2 id="session-title">
            {index + 1} / {questions.length}
          </h2>
        </div>
        <button
          className={`icon-button ${isFavorite ? 'active' : ''}`}
          aria-label={isFavorite ? '取消收藏' : '收藏题目'}
          aria-pressed={isFavorite}
          onClick={() => void toggleFavorite(db, question.id)}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </header>

      <div className="progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      <article className="question-card">
        <div className="topic-row">
          {question.topics.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
          <span>{question.difficulty}</span>
        </div>
        <fieldset disabled={Boolean(result)}>
          <legend>{question.prompt}</legend>
          <div className="choices">
            {question.choices.map((choice, choiceIndex) => {
              const checked = selected.includes(choice.id);
              const isCorrect = result?.reveal.correctChoiceIds.includes(choice.id);
              const isWrongSelection = Boolean(result && checked && !isCorrect);
              return (
                <label
                  key={choice.id}
                  className={[
                    'choice',
                    checked ? 'selected' : '',
                    result && isCorrect ? 'correct' : '',
                    isWrongSelection ? 'wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    value={choice.id}
                    checked={checked}
                    onChange={() => setSelected([choice.id])}
                  />
                  <span className="choice-key">{String.fromCharCode(65 + choiceIndex)}</span>
                  <span>{choice.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {result && (
          <>
            <div
              className={`answer-panel ${result.attempt.correct ? 'success' : 'error'}`}
              role="status"
            >
              <strong>{result.attempt.correct ? '回答正确' : '这次没答对'}</strong>
              <p>{result.reveal.explanation}</p>
            </div>
            <TutorPanel prompt={question} reveal={result.reveal} attempt={result.attempt} />
          </>
        )}

        <button
          className="primary-button full-width"
          disabled={selected.length === 0}
          onClick={result ? next : () => void submit()}
        >
          {result ? (index + 1 === questions.length ? '完成练习' : '下一题') : '提交答案'}
        </button>
      </article>
    </section>
  );
}

function DataCenter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const counts = useLiveQuery(
    async () => ({
      attempts: await db.attempts.count(),
      favorites: await db.favorites.count(),
      reviews: await db.reviews.count(),
    }),
    [],
    { attempts: 0, favorites: 0, reviews: 0 },
  );

  async function downloadBackup() {
    const data = await exportStudyData(db);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `agentprep-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('学习数据已导出。');
  }

  async function restore(file: File) {
    try {
      await importStudyData(db, await file.text());
      setMessage('导入完成，当前设备的数据已恢复。');
    } catch (error) {
      setMessage(error instanceof Error ? `导入失败：${error.message}` : '导入失败。');
    }
  }

  return (
    <section className="data-center" aria-labelledby="data-title">
      <p className="overline">LOCAL DATA</p>
      <h2 id="data-title">你的记录，只在你的设备</h2>
      <p>备份文件只包含作答、收藏、复习计划和设置，不包含题库答案或任何 API Key。</p>
      <div className="data-summary">
        <div>
          <strong>{counts.attempts}</strong>
          <span>次作答</span>
        </div>
        <div>
          <strong>{counts.favorites}</strong>
          <span>道收藏</span>
        </div>
        <div>
          <strong>{counts.reviews}</strong>
          <span>条复习计划</span>
        </div>
      </div>
      <div className="data-actions">
        <button className="primary-button" onClick={() => void downloadBackup()}>
          导出学习数据
        </button>
        <button className="secondary-button" onClick={() => inputRef.current?.click()}>
          导入备份
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="选择 AgentPrep 备份文件"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restore(file);
            event.target.value = '';
          }}
        />
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <small>存储 Schema v2 · 备份 Schema v1 · 题库 {questionManifest.contentVersion}</small>
    </section>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (view: View) => void }) {
  const attemptCount = useLiveQuery(() => db.attempts.count(), [], 0);
  const favoriteCount = useLiveQuery(() => db.favorites.count(), [], 0);
  const wrongIds = useLiveQuery(() => getLatestWrongQuestionIds(db), [], []);
  const dueIds = useLiveQuery(() => getDueReviewQuestionIds(db), [], []);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <p className="overline">LOCAL-FIRST INTERVIEW PREP</p>
          <h1 id="hero-title">
            把每次答错，
            <br />
            变成下次答对。
          </h1>
          <p className="intro">
            面向 Agent / LLM 岗秋招的可追溯题库。离线刷题，按节奏复习，需要时再请 AI Tutor 帮忙。
          </p>
          <button className="primary-button" onClick={() => onNavigate('practice')}>
            开始刷题 <span>→</span>
          </button>
        </div>
        <div className="hero-metric" aria-label={`累计完成 ${attemptCount} 次作答`}>
          <strong>{attemptCount}</strong>
          <span>累计作答</span>
        </div>
      </section>

      <section className="quick-grid" aria-label="学习入口">
        <button onClick={() => onNavigate('wrong')}>
          <span className="quick-icon rust">↺</span>
          <strong>错题回看</strong>
          <small>{wrongIds.length} 道待巩固</small>
        </button>
        <button onClick={() => onNavigate('review')}>
          <span className="quick-icon gold">◷</span>
          <strong>今日复习</strong>
          <small>{dueIds.length} 道已到期</small>
        </button>
        <button onClick={() => onNavigate('favorites')}>
          <span className="quick-icon blue">☆</span>
          <strong>我的收藏</strong>
          <small>{favoriteCount} 道已收藏</small>
        </button>
      </section>

      <section className="source-note">
        <div>
          <p className="overline">TRACEABLE BY DEFAULT</p>
          <h2>每道题都有来路</h2>
        </div>
        <p>
          当前 {questionManifest.questions.length} 道小样题均为 AgentPrep
          原创并经人工审核。来源、版本、许可证和转换记录随 manifest 保存。
        </p>
      </section>
    </>
  );
}

export function App() {
  const [view, setView] = useState<View>('home');
  const online = useOnlineStatus();
  const wrongIds = useLiveQuery(() => getLatestWrongQuestionIds(db), [], []);
  const favoriteIds = useLiveQuery(
    async () => (await db.favorites.toCollection().primaryKeys()).map(String),
    [],
    [] as string[],
  );
  const dueIds = useLiveQuery(() => getDueReviewQuestionIds(db), [], []);

  const queue = useMemo(() => {
    const ids =
      view === 'wrong'
        ? wrongIds
        : view === 'favorites'
          ? favoriteIds
          : view === 'review'
            ? dueIds
            : [];
    return view === 'practice'
      ? questionPrompts
      : questionPrompts.filter((question) => ids.includes(question.id));
  }, [dueIds, favoriteIds, view, wrongIds]);

  const isSession = ['practice', 'wrong', 'favorites', 'review'].includes(view);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="返回 AgentPrep 首页">
          <span>AP</span> AgentPrep
        </button>
        <span className={`network ${online ? '' : 'offline'}`} role="status">
          <i aria-hidden="true" />
          {online ? '本地数据已就绪' : '离线模式'}
        </span>
      </header>

      <main>
        {view === 'home' && <Dashboard onNavigate={setView} />}
        {isSession && (
          <QuestionSession
            questions={queue}
            title={viewLabels[view]}
            onExit={() => setView('home')}
          />
        )}
        {view === 'data' && <DataCenter />}
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        {(['home', 'practice', 'review', 'data'] as const).map((item) => (
          <button
            key={item}
            className={view === item ? 'active' : ''}
            aria-current={view === item ? 'page' : undefined}
            onClick={() => setView(item)}
          >
            <span aria-hidden="true">
              {item === 'home' ? '⌂' : item === 'practice' ? '▣' : item === 'review' ? '◷' : '⇅'}
            </span>
            {viewLabels[item]}
          </button>
        ))}
      </nav>
    </div>
  );
}
