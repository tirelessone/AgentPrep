import type { FavoriteQuestion, LocalSetting, StudyAttempt } from '@agentprep/domain';

import type { AuthAdapter, AuthResult, AuthUser, SignUpCredentials } from './auth';
import type { CloudRuntime } from './runtime';
import type { CloudStudyStore } from './types';

const ACCOUNTS_KEY = 'agentprep-e2e-accounts';
const SESSION_KEY = 'agentprep-e2e-session';

interface StoredAccount {
  user: AuthUser;
}

function readJson<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : fallback;
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

class BrowserFakeAuthAdapter implements AuthAdapter {
  readonly available = true;
  private readonly listeners = new Set<(user: AuthUser | null) => void>();

  async getCurrentUser() {
    return readJson<AuthUser | null>(SESSION_KEY, null);
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn({ email, password }: SignUpCredentials) {
    const account = readJson<Record<string, StoredAccount>>(ACCOUNTS_KEY, {})[email.toLowerCase()];
    if (!account || password !== 'password123') throw new Error('邮箱或密码错误。');
    this.setSession(account.user);
    return account.user;
  }

  async signUp({ email }: SignUpCredentials): Promise<AuthResult> {
    const accounts = readJson<Record<string, StoredAccount>>(ACCOUNTS_KEY, {});
    const key = email.toLowerCase();
    if (accounts[key]) throw new Error('该邮箱已注册。');
    const user = { id: crypto.randomUUID(), email: key };
    accounts[key] = { user };
    writeJson(ACCOUNTS_KEY, accounts);
    this.setSession(user);
    return { user, requiresEmailConfirmation: false };
  }

  async signOut() {
    this.setSession(null);
  }

  private setSession(user: AuthUser | null) {
    if (user) writeJson(SESSION_KEY, user);
    else localStorage.removeItem(SESSION_KEY);
    this.listeners.forEach((listener) => listener(user));
  }
}

class BrowserFakeCloudStore implements CloudStudyStore {
  constructor(private readonly userId: string) {}

  private read<T>(kind: string) {
    this.ensureOnline();
    return readJson<T[]>(`agentprep-e2e-cloud-${this.userId}-${kind}`, []);
  }

  private write(kind: string, values: unknown) {
    this.ensureOnline();
    writeJson(`agentprep-e2e-cloud-${this.userId}-${kind}`, values);
  }

  private ensureOnline() {
    if (!navigator.onLine) throw new Error('Fake cloud is offline.');
  }

  async fetchAttempts() {
    return this.read<StudyAttempt>('attempts');
  }

  async fetchFavorites() {
    return this.read<FavoriteQuestion>('favorites');
  }

  async fetchSettings() {
    return this.read<LocalSetting>('settings');
  }

  async upsertAttempts(attempts: readonly StudyAttempt[]) {
    const merged = new Map(this.read<StudyAttempt>('attempts').map((item) => [item.id, item]));
    attempts.forEach((attempt) => {
      if (!merged.has(attempt.id)) merged.set(attempt.id, attempt);
    });
    this.write('attempts', [...merged.values()]);
  }

  async upsertFavorites(favorites: readonly FavoriteQuestion[]) {
    const merged = new Map(
      this.read<FavoriteQuestion>('favorites').map((item) => [item.questionId, item]),
    );
    favorites.forEach((favorite) => merged.set(favorite.questionId, favorite));
    this.write('favorites', [...merged.values()]);
  }

  async upsertSettings(settings: readonly LocalSetting[]) {
    const merged = new Map(this.read<LocalSetting>('settings').map((item) => [item.key, item]));
    settings.forEach((setting) => merged.set(setting.key, setting));
    this.write('settings', [...merged.values()]);
  }
}

export function createE2eCloudRuntime(): CloudRuntime {
  return {
    auth: new BrowserFakeAuthAdapter(),
    createStudyStore(userId: string) {
      return new BrowserFakeCloudStore(userId);
    },
  };
}
