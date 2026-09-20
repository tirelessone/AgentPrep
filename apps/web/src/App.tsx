import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import type {
  QuestionPrompt,
  QuestionResponse,
  QuestionReveal,
  StudyAttempt,
} from '@agentprep/domain';
import { getChapterLabel, getDifficultyLabel, getSubjectLabel } from '@agentprep/taxonomy';

import { AccountCenter, GuestMigrationActions } from './AccountCenter';
import { AccountProvider, getSyncStatusLabel, useAccount } from './AccountContext';
import { exportStudyData, importStudyData } from './backup';
import type { CloudRuntime } from './cloud/runtime';
import { loadQuestionContent, type QuestionContent } from './content';
import type { AgentPrepDatabase } from './db';
import { PracticeSelection } from './features/practice/PracticeSelection';
import { QuestionRenderer } from './features/practice/QuestionRenderer';
import {
  getPracticeModeLabel,
  selectPracticeQuestions,
  type PracticeSelectionValue,
} from './features/practice/practice-selection';
import { InstallButton } from './InstallButton';
import { getTutorAvailability, runtimePlatform, type RuntimePlatform } from './runtime';
import { TutorPanel } from './TutorPanel';
import {
  getDueReviewQuestionIds,
  getLatestWrongQuestionIds,
  recordAttempt,
  toggleFavorite,
} from './study-service';

type View =
  | 'home'
  | 'practice-select'
  | 'practice-session'
  | 'wrong'
  | 'favorites'
  | 'review'
  | 'data'
  | 'account';

const viewLabels: Record<View, string> = {
  home: '首页',
  'practice-select': '刷题',
  'practice-session': '专项练习',
  wrong: '错题',
  favorites: '收藏',
  review: '复习',
  data: '数据',
  account: '账号',
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
  database,
  onLocalMutation,
  questions,
  title,
  revealQuestion,
  onExit,
  platform,
}: {
  database: AgentPrepDatabase;
  onLocalMutation: () => void;
  questions: readonly QuestionPrompt[];
  title: string;
  revealQuestion: QuestionContent['revealQuestion'];
  onExit: () => void;
  platform: RuntimePlatform;
}) {
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<QuestionResponse>();
  const [reveal, setReveal] = useState<QuestionReveal>();
  const [attempt, setAttempt] = useState<StudyAttempt>();
  const previousQuestionsRef = useRef(questions);
  const question = questions[index];
  const favoriteIds = useLiveQuery(
    async () =>
      (await database.favorites.filter((favorite) => favorite.isFavorite).toArray()).map(
        (favorite) => favorite.questionId,
      ),
    [database],
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
    const nextAttempt = await recordAttempt(database, question!, nextReveal, response);
    setReveal(nextReveal);
    setAttempt(nextAttempt);
    onLocalMutation();
  }

  async function assessOral(selfAssessment: 'understood' | 'needs_review') {
    if (!question || question.type !== 'oral' || !reveal || reveal.type !== 'oral' || attempt)
      return;
    const nextAttempt = await recordAttempt(database, question, reveal, {
      type: 'oral',
      selfAssessment,
    });
    setAttempt(nextAttempt);
    onLocalMutation();
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
          onClick={() => {
            void toggleFavorite(database, question.id).then(onLocalMutation);
          }}
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
              <TutorAvailability
                prompt={question}
                reveal={reveal}
                attempt={attempt}
                platform={platform}
              />
            )}
            {question.type === 'multiple_choice' && reveal.type === 'multiple_choice' && (
              <TutorAvailability
                prompt={question}
                reveal={reveal}
                attempt={attempt}
                platform={platform}
              />
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

function TutorAvailability({
  prompt,
  reveal,
  attempt,
  platform,
}: {
  prompt: Extract<QuestionPrompt, { type: 'single_choice' | 'multiple_choice' }>;
  reveal: Extract<QuestionReveal, { type: 'single_choice' | 'multiple_choice' }>;
  attempt: StudyAttempt;
  platform: RuntimePlatform;
}) {
  const availability = getTutorAvailability(platform, import.meta.env.DEV, import.meta.env.MODE);
  if (availability === 'enabled') {
    return <TutorPanel prompt={prompt} reveal={reveal} attempt={attempt} />;
  }
  return (
    <p className="notice">
      {availability === 'desktop-disabled'
        ? 'AI Tutor 尚未在桌面版启用。'
        : 'AI Tutor 尚未在此部署环境启用。'}
    </p>
  );
}

function DataCenter({
  contentVersion,
  database,
  onLocalMutation,
}: {
  contentVersion: string;
  database: AgentPrepDatabase;
  onLocalMutation: () => void;
}) {
  const account = useAccount();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const counts = useLiveQuery(
    async () => ({
      attempts: await database.attempts.count(),
      favorites: await database.favorites.filter((favorite) => favorite.isFavorite).count(),
      reviews: await database.reviews.count(),
    }),
    [database],
    { attempts: 0, favorites: 0, reviews: 0 },
  );

  async function downloadBackup() {
    const data = await exportStudyData(database);
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
      await importStudyData(database, await file.text());
      onLocalMutation();
      setMessage('导入完成，当前设备的数据已恢复。');
    } catch (error) {
      setMessage(error instanceof Error ? `导入失败：${error.message}` : '导入失败。');
    }
  }

  return (
    <section className="data-center" aria-labelledby="data-title">
      <p className="overline">LOCAL-FIRST DATA</p>
      <h2 id="data-title">学习数据</h2>
      <p>
        {account.user
          ? '学习记录优先保存在当前设备，并同步到你的 AgentPrep 账号。'
          : '学习记录保存在当前设备。登录后可选择跨设备同步。'}
      </p>
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
      <section className="cloud-summary" aria-labelledby="cloud-summary-title">
        <h3 id="cloud-summary-title">Cloud Sync</h3>
        <p>
          <strong>账号：</strong> {account.user?.email ?? '未登录'}
        </p>
        <p>
          <strong>同步状态：</strong>{' '}
          {getSyncStatusLabel(account.syncStatus, Boolean(account.user))}
        </p>
        <p>
          <strong>最后同步：</strong>{' '}
          {account.lastSuccessfulSyncAt
            ? new Date(account.lastSuccessfulSyncAt).toLocaleString('zh-CN')
            : '尚未完成'}
        </p>
        {account.user && (
          <button className="secondary-button" onClick={() => void account.syncNow()}>
            立即同步
          </button>
        )}
        {account.syncWarnings.length > 0 && (
          <p className="notice" role="status">
            检测到 {account.syncWarnings.length} 条作答 ID 冲突，已保留云端记录。
          </p>
        )}
      </section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <small>存储 Schema v3 · 备份 Schema v2 · 题库 {contentVersion}</small>
    </section>
  );
}

function Dashboard({
  database,
  questionCount,
  onNavigate,
}: {
  database: AgentPrepDatabase;
  questionCount: number;
  onNavigate: (view: View) => void;
}) {
  const attemptCount = useLiveQuery(() => database.attempts.count(), [database], 0);
  const favoriteCount = useLiveQuery(
    () => database.favorites.filter((favorite) => favorite.isFavorite).count(),
    [database],
    0,
  );
  const wrongIds = useLiveQuery(() => getLatestWrongQuestionIds(database), [database], []);
  const dueIds = useLiveQuery(() => getDueReviewQuestionIds(database), [database], []);

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

function LoadedApp({ content, platform }: { content: QuestionContent; platform: RuntimePlatform }) {
  const account = useAccount();
  const database = account.database;
  const { manifest: questionManifest, questionPrompts, revealQuestion } = content;
  const [view, setView] = useState<View>('home');
  const [practiceSelection, setPracticeSelection] = useState<PracticeSelectionValue>();
  const [practiceQueue, setPracticeQueue] = useState<readonly QuestionPrompt[]>([]);
  const online = useOnlineStatus();
  const wrongIds = useLiveQuery(() => getLatestWrongQuestionIds(database), [database], []);
  const favoriteIds = useLiveQuery(
    async () =>
      (await database.favorites.filter((favorite) => favorite.isFavorite).toArray()).map(
        (favorite) => favorite.questionId,
      ),
    [database],
    [] as string[],
  );
  const dueIds = useLiveQuery(() => getDueReviewQuestionIds(database), [database], []);
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
    const questions = await selectPracticeQuestions(database, questionPrompts, selection);
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
          <InstallButton platform={platform} />
          <button className="account-entry" onClick={() => setView('account')}>
            {account.user?.email ?? (account.authAvailable ? '登录 / 注册' : '仅本机')}
          </button>
          <span
            className={`network ${!online || account.syncStatus === 'error' ? 'offline' : ''}`}
            role="status"
          >
            <i aria-hidden="true" />
            {online ? getSyncStatusLabel(account.syncStatus, Boolean(account.user)) : '离线模式'}
          </span>
        </div>
      </header>

      {account.guestMigrationPending && view !== 'account' && <GuestMigrationActions />}

      <main>
        {view === 'home' && (
          <Dashboard
            database={database}
            questionCount={questionManifest.questions.length}
            onNavigate={setView}
          />
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
            database={database}
            onLocalMutation={account.notifyLocalMutation}
            questions={queue}
            title={sessionTitle}
            revealQuestion={revealQuestion}
            onExit={() => setView('home')}
            platform={platform}
          />
        )}
        {view === 'data' && (
          <DataCenter
            database={database}
            contentVersion={questionManifest.contentVersion}
            onLocalMutation={account.notifyLocalMutation}
          />
        )}
        {view === 'account' && <AccountCenter />}
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

function QuestionContentApp({
  content: suppliedContent,
  platform,
}: {
  content?: QuestionContent | undefined;
  platform: RuntimePlatform;
}) {
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

  return <LoadedApp content={content} platform={platform} />;
}

export function App({
  content,
  database,
  runtime,
  platform = runtimePlatform,
}: {
  content?: QuestionContent | undefined;
  database?: AgentPrepDatabase | undefined;
  runtime?: CloudRuntime | undefined;
  platform?: RuntimePlatform | undefined;
}) {
  return (
    <AccountProvider database={database} runtime={runtime}>
      <QuestionContentApp content={content} platform={platform} />
    </AccountProvider>
  );
}
