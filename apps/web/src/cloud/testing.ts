import type { FavoriteQuestion, LocalSetting, StudyAttempt } from '@agentprep/domain';

import type { AuthAdapter, AuthResult, AuthUser, SignUpCredentials } from './auth';
import type { CloudStudyStore } from './types';

export class FakeCloudStudyStore implements CloudStudyStore {
  readonly attempts = new Map<string, StudyAttempt>();
  readonly favorites = new Map<string, FavoriteQuestion>();
  readonly settings = new Map<string, LocalSetting>();
  online = true;
  fetchCount = 0;

  private ensureOnline() {
    if (!this.online) throw new Error('Fake cloud is offline.');
  }

  async fetchAttempts() {
    this.ensureOnline();
    this.fetchCount += 1;
    return [...this.attempts.values()];
  }

  async fetchFavorites() {
    this.ensureOnline();
    return [...this.favorites.values()];
  }

  async fetchSettings() {
    this.ensureOnline();
    return [...this.settings.values()];
  }

  async upsertAttempts(attempts: readonly StudyAttempt[]) {
    this.ensureOnline();
    attempts.forEach((attempt) => {
      if (!this.attempts.has(attempt.id)) this.attempts.set(attempt.id, attempt);
    });
  }

  async upsertFavorites(favorites: readonly FavoriteQuestion[]) {
    this.ensureOnline();
    favorites.forEach((favorite) => this.favorites.set(favorite.questionId, favorite));
  }

  async upsertSettings(settings: readonly LocalSetting[]) {
    this.ensureOnline();
    settings.forEach((setting) => this.settings.set(setting.key, setting));
  }
}

export class FakeAuthAdapter implements AuthAdapter {
  readonly available = true;
  private currentUser: AuthUser | null = null;
  private readonly listeners = new Set<(user: AuthUser | null) => void>();
  private readonly users = new Map<string, { user: AuthUser; password: string }>();

  async getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn({ email, password }: SignUpCredentials) {
    const account = this.users.get(email.toLowerCase());
    if (!account || account.password !== password) throw new Error('邮箱或密码错误。');
    this.setUser(account.user);
    return account.user;
  }

  async signUp({ email, password }: SignUpCredentials): Promise<AuthResult> {
    const key = email.toLowerCase();
    if (this.users.has(key)) throw new Error('该邮箱已注册。');
    const user = { id: crypto.randomUUID(), email: key };
    this.users.set(key, { user, password });
    this.setUser(user);
    return { user, requiresEmailConfirmation: false };
  }

  async signOut() {
    this.setUser(null);
  }

  seedUser(email: string, password = 'password123') {
    const key = email.toLowerCase();
    const user = { id: crypto.randomUUID(), email: key };
    this.users.set(key, { user, password });
    return user;
  }

  setUser(user: AuthUser | null) {
    this.currentUser = user;
    this.listeners.forEach((listener) => listener(user));
  }
}

export function createFakeCloudRuntime(
  auth = new FakeAuthAdapter(),
  stores = new Map<string, FakeCloudStudyStore>(),
) {
  return {
    auth,
    createStudyStore(userId: string) {
      let store = stores.get(userId);
      if (!store) {
        store = new FakeCloudStudyStore();
        stores.set(userId, store);
      }
      return store;
    },
  };
}
