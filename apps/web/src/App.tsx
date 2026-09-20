import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import type {
  QuestionPrompt,
  QuestionResponse,
  QuestionReveal,
  StudyAttempt,
} from '@agentprep/domain';
import { getChapterLabel, getDifficultyLabel, getSubjectLabel } from '@agentprep/taxonomy';

import { exportStudyData, importStudyData } from './backup';
import { loadQuestionContent, type QuestionContent } from './content';
import { db } from './db';
import { PracticeSelection } from './features/practice/PracticeSelection';
import { QuestionRenderer } from './features/practice/QuestionRenderer';
import {
  getPracticeModeLabel,
  selectPracticeQuestions,
  type PracticeSelectionValue,
} from './features/practice/practice-selection';
import { InstallButton } from './InstallButton';
import { TutorPanel } from './TutorPanel';
import {
  getDueReviewQuestionIds,
  getLatestWrongQuestionIds,
  recordAttempt,
  toggleFavorite,
} from './study-service';

type View =
  'home' | 'practice-select' | 'practice-session' | 'wrong' | 'favorites' | 'review' | 'data';

const viewLabels: Record<View, string> = {
  home: '首页',
  'practice-select': '刷题',
  'practice-session': '专项练习',
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
  revealQuestion,
  onExit,
}: {
  questions: readonly QuestionPrompt[];
  title: string;
  revealQuestion: QuestionContent['revealQuestion'];
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<QuestionResponse>();
  const [reveal, setReveal] = useState<QuestionReveal>();
  const [attempt, setAttempt] = useState<StudyAttempt>();
  const previousQuestionsRef = useRef(questions);
  const question = questions[index];
  const favoriteIds = useLiveQuery(
    async () => (await db.favorites.toCollection().primaryKeys()).map(String),
    [],
    [] as string[],
  );
  const isFavorite = question ? favoriteIds.includes(question.id) : false;

  useEffect(() => {
    if (previousQuestionsRef.current === questions) return;
    previousQuestionsRef.current = questions;
    setIndex(0);
    setResponse(undefined);
    setReveal(undefined);
    setAttempt(undefined);
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
    if (reveal) return;
    const nextReveal = revealQuestion(question!.id);
    if (question!.type === 'oral') {
      setReveal(nextReveal);
      return;
    }
    if (!response) return;
    const nextAttempt = await recordAttempt(db, question!, nextReveal, response);
    setReveal(nextReveal);
    setAttempt(nextAttempt);
  }

  async function assessOral(selfAssessment: 'understood' | 'needs_review') {
    if (!question || question.type !== 'oral' || !reveal || reveal.type !== 'oral' || attempt)
      return;
    const nextAttempt = await recordAttempt(db, question, reveal, {
      type: 'oral',
      selfAssessment,
    });
    setAttempt(nextAttempt);
  }

  function next() {
    if (index + 1 >= questions.length) {
      onExit();
      return;
    }
    setIndex((current) => current + 1);
    setResponse(undefined);
    setReveal(undefined);
    setAttempt(undefined);
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
          <span>{getSubjectLabel(question.subject)}</span>
          <span>{getChapterLabel(question.subject, question.chapter)}</span>
          {question.knowledgePoints.map((knowledgePoint) => (
            <span key={knowledgePoint}>{knowledgePoint}</span>
          ))}
          <span>{getDifficultyLabel(question.difficulty)}</span>
          <span>重要度 {question.importance}</span>
        </div>
        <QuestionRenderer
          disabled={Boolean(reveal)}
          question={question}
          response={response}
          reveal={reveal}
          onChange={setResponse}
        />

        {attempt && reveal && reveal.type !== 'oral' && (
          <>
            <div className={`answer-panel ${attempt.correct ? 'success' : 'error'}`} role="status">
              <strong>{attempt.correct ? '回答正确' : '这次没答对'}</strong>
              <p>{reveal.explanation}</p>
            </div>
            {question.type === 'single_choice' && reveal.type === 'single_choice' && (
              <TutorPanel prompt={question} reveal={reveal} attempt={attempt} />
            )}
            {question.type === 'multiple_choice' && reveal.type === 'multiple_choice' && (
              <TutorPanel prompt={question} reveal={reveal} attempt={attempt} />
            )}
          </>
        )}

        {reveal?.type === 'oral' && (
          <section className="oral-answer" aria-labelledby="oral-reference-title">
            <h3 id="oral-reference-title">参考答案</h3>
            <p>{reveal.referenceAnswer}</p>
            <h4>回答要点</h4>
            <ul>
              {reveal.keyPoints.map((keyPoint) => (
                <li key={keyPoint}>{keyPoint}</li>
              ))}
            </ul>
            {reveal.followUps.length > 0 && (
              <>
                <h4>可能追问</h4>
                <ul>
                  {reveal.followUps.map((followUp) => (
                    <li key={followUp}>{followUp}</li>
                  ))}
                </ul>
              </>
            )}
            {!attempt ? (
              <div className="oral-actions" aria-label="口述题自评">
                <button
                  className="secondary-button"
                  onClick={() => void assessOral('needs_review')}
                >
                  需要复习
                </button>
                <button className="primary-button" onClick={() => void assessOral('understood')}>
                  已掌握
                </button>
              </div>
            ) : (
              <p className={`notice ${attempt.correct ? '' : 'oral-review-notice'}`} role="status">
                {attempt.correct ? '已记录为掌握。' : '已加入待复习队列。'}
              </p>
            )}
          </section>
        )}

        {(!reveal || attempt) && (
          <button
            className="primary-button full-width"
            disabled={!reveal && question.type !== 'oral' && !response}
            onClick={reveal ? next : () => void submit()}
          >
            {reveal
              ? index + 1 === questions.length
                ? '完成练习'
                : '下一题'
              : question.type === 'oral'
                ? '查看参考答案'
                : '提交答案'}
          </button>
        )}
      </article>
    </section>
  );
}

function DataCenter({ contentVersion }: { contentVersion: string }) {
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
      <small>存储 Schema v2 · 备份 Schema v1 · 题库 {contentVersion}</small>
    </section>
  );
}

function Dashboard({
  questionCount,
  onNavigate,
}: {
  questionCount: number;
  onNavigate: (view: View) => void;
}) {
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
          <button className="primary-button" onClick={() => onNavigate('practice-select')}>
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
          当前共 {questionCount} 道题。题库由 AgentPrep 原创内容与可追溯外部数据源组成，
          每道外部题目保留来源与转换信息。
        </p>
      </section>
    </>
  );
}

function LoadedApp({ content }: { content: QuestionContent }) {
  const { manifest: questionManifest, questionPrompts, revealQuestion } = content;
  const [view, setView] = useState<View>('home');
  const [practiceSelection, setPracticeSelection] = useState<PracticeSelectionValue>();
  const [practiceQueue, setPracticeQueue] = useState<readonly QuestionPrompt[]>([]);
  const online = useOnlineStatus();
  const wrongIds = useLiveQuery(() => getLatestWrongQuestionIds(db), [], []);
  const favoriteIds = useLiveQuery(
    async () => (await db.favorites.toCollection().primaryKeys()).map(String),
    [],
    [] as string[],
  );
  const dueIds = useLiveQuery(() => getDueReviewQuestionIds(db), [], []);
  const queue = useMemo(() => {
    if (view === 'practice-session') return practiceQueue;
    const ids =
      view === 'wrong'
        ? wrongIds
        : view === 'favorites'
          ? favoriteIds
          : view === 'review'
            ? dueIds
            : [];
    return questionPrompts.filter((question) => ids.includes(question.id));
  }, [dueIds, favoriteIds, practiceQueue, questionPrompts, view, wrongIds]);

  const isSession = ['practice-session', 'wrong', 'favorites', 'review'].includes(view);
  const sessionTitle =
    view === 'practice-session' && practiceSelection
      ? `${getSubjectLabel(practiceSelection.subject)} · ${
          practiceSelection.chapter
            ? getChapterLabel(practiceSelection.subject, practiceSelection.chapter)
            : '全部章节'
        } · ${getPracticeModeLabel(practiceSelection.mode)}`
      : viewLabels[view];

  async function startPractice(selection: PracticeSelectionValue) {
    const questions = await selectPracticeQuestions(db, questionPrompts, selection);
    if (questions.length === 0) return false;
    setPracticeSelection(selection);
    setPracticeQueue(questions);
    setView('practice-session');
    return true;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('home')} aria-label="返回 AgentPrep 首页">
          <span>AP</span> AgentPrep
        </button>
        <div className="topbar-actions">
          <InstallButton />
          <span className={`network ${online ? '' : 'offline'}`} role="status">
            <i aria-hidden="true" />
            {online ? '本地数据已就绪' : '离线模式'}
          </span>
        </div>
      </header>

      <main>
        {view === 'home' && (
          <Dashboard questionCount={questionManifest.questions.length} onNavigate={setView} />
        )}
        {view === 'practice-select' && (
          <PracticeSelection
            questions={questionPrompts}
            onBack={() => setView('home')}
            onStart={startPractice}
          />
        )}
        {isSession && (
          <QuestionSession
            questions={queue}
            title={sessionTitle}
            revealQuestion={revealQuestion}
            onExit={() => setView('home')}
          />
        )}
        {view === 'data' && <DataCenter contentVersion={questionManifest.contentVersion} />}
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        {(['home', 'practice-select', 'review', 'data'] as const).map((item) => (
          <button
            key={item}
            className={
              view === item || (item === 'practice-select' && view === 'practice-session')
                ? 'active'
                : ''
            }
            aria-current={
              view === item || (item === 'practice-select' && view === 'practice-session')
                ? 'page'
                : undefined
            }
            onClick={() => setView(item)}
          >
            <span aria-hidden="true">
              {item === 'home'
                ? '⌂'
                : item === 'practice-select'
                  ? '▣'
                  : item === 'review'
                    ? '◷'
                    : '⇅'}
            </span>
            {viewLabels[item]}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function App({ content: suppliedContent }: { content?: QuestionContent | undefined }) {
  const [content, setContent] = useState<QuestionContent | undefined>(suppliedContent);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (suppliedContent) {
      setContent(suppliedContent);
      setLoadError('');
      return;
    }

    let active = true;
    void loadQuestionContent()
      .then((loaded) => {
        if (active) setContent(loaded);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : '题库加载失败。');
        }
      });
    return () => {
      active = false;
    };
  }, [suppliedContent]);

  if (!content) {
    return (
      <div className="app-shell">
        <main>
          <section className="empty-state" aria-live="polite">
            <span aria-hidden="true">{loadError ? '!' : '…'}</span>
            <h2>{loadError ? '题库暂时无法加载' : '正在准备题库'}</h2>
            <p>{loadError || '正在校验原创内容与计算机网络题库。'}</p>
            {loadError && (
              <button className="primary-button" onClick={() => window.location.reload()}>
                重新加载
              </button>
            )}
          </section>
        </main>
      </div>
    );
  }

  return <LoadedApp content={content} />;
}
