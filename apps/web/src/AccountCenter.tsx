import { type FormEvent, useState } from 'react';

import { getSyncStatusLabel, useAccount } from './AccountContext';

type AuthMode = 'login' | 'register';

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AccountCenter() {
  const account = useAccount();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!validateEmail(email)) {
      setMessage('请输入有效的邮箱地址。');
      return;
    }
    if (password.length < 8) {
      setMessage('密码至少需要 8 位。');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setMessage('两次输入的密码不一致。');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await account.signIn({ email, password });
        setMessage('登录成功，正在同步学习记录。');
      } else {
        const result = await account.signUp({ email, password });
        setMessage(
          result.requiresEmailConfirmation
            ? '注册成功，请检查邮箱完成验证。'
            : '注册成功，正在同步学习记录。',
        );
      }
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  if (account.user) {
    return (
      <section className="account-center" aria-labelledby="account-title">
        <p className="overline">OPTIONAL ACCOUNT</p>
        <h2 id="account-title">账号与同步</h2>
        <div className="account-details">
          <p>
            <strong>账号</strong>
            <span>{account.user.email}</span>
          </p>
          <p>
            <strong>同步</strong>
            <span>{getSyncStatusLabel(account.syncStatus, true)}</span>
          </p>
          <p>
            <strong>最近同步</strong>
            <span>
              {account.lastSuccessfulSyncAt
                ? new Date(account.lastSuccessfulSyncAt).toLocaleString('zh-CN')
                : '尚未完成'}
            </span>
          </p>
        </div>
        <div className="data-actions">
          <button
            className="primary-button"
            disabled={account.syncStatus === 'syncing'}
            onClick={() => void account.syncNow()}
          >
            立即同步
          </button>
          <button className="secondary-button" onClick={() => void account.signOut()}>
            退出登录
          </button>
        </div>
        {account.syncWarnings.length > 0 && (
          <p className="notice" role="status">
            同步完成，但检测到 {account.syncWarnings.length} 条作答 ID 冲突；已保留云端记录。
          </p>
        )}
        {account.guestMigrationPending && <GuestMigrationActions />}
      </section>
    );
  }

  if (!account.authAvailable) {
    return (
      <section className="account-center" aria-labelledby="account-title">
        <p className="overline">LOCAL MODE</p>
        <h2 id="account-title">当前仅使用本机</h2>
        <p>此部署尚未配置账号服务。刷题、收藏、错题、复习和备份仍可离线使用。</p>
      </section>
    );
  }

  return (
    <section className="account-center" aria-labelledby="account-title">
      <p className="overline">OPTIONAL ACCOUNT</p>
      <h2 id="account-title">{mode === 'login' ? '登录 AgentPrep' : '注册 AgentPrep'}</h2>
      <p>账号可选；登录后，学习状态会在你的设备之间同步。</p>
      <div className="auth-tabs" role="tablist" aria-label="账号操作">
        <button
          role="tab"
          aria-selected={mode === 'login'}
          className={mode === 'login' ? 'selected' : ''}
          onClick={() => {
            setMode('login');
            setMessage('');
          }}
        >
          登录
        </button>
        <button
          role="tab"
          aria-selected={mode === 'register'}
          className={mode === 'register' ? 'selected' : ''}
          onClick={() => {
            setMode('register');
            setMessage('');
          }}
        >
          注册
        </button>
      </div>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>
          邮箱
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          密码
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {mode === 'register' && (
          <label>
            确认密码
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        )}
        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? '处理中…' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export function GuestMigrationActions() {
  const account = useAccount();
  return (
    <section className="migration-card" aria-labelledby="migration-title">
      <h3 id="migration-title">检测到本机学习记录</h3>
      <p>可以合并到当前账号。原本的本机记录会保留，不会删除。</p>
      <div className="data-actions">
        <button className="primary-button" onClick={() => void account.mergeGuestData()}>
          合并到我的账号
        </button>
        <button className="secondary-button" onClick={() => void account.skipGuestMigration()}>
          暂不合并
        </button>
      </div>
    </section>
  );
}
