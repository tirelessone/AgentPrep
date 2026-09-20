export interface AuthUser {
  id: string;
  email: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: AuthUser | null;
  requiresEmailConfirmation: boolean;
}

export interface AuthAdapter {
  readonly available: boolean;
  getCurrentUser(): Promise<AuthUser | null>;
  onAuthStateChange(listener: (user: AuthUser | null) => void): () => void;
  signIn(credentials: SignUpCredentials): Promise<AuthUser>;
  signUp(credentials: SignUpCredentials): Promise<AuthResult>;
  signOut(): Promise<void>;
}

export class CloudUnavailableError extends Error {
  constructor() {
    super('Cloud accounts are not configured for this deployment.');
    this.name = 'CloudUnavailableError';
  }
}

export const unavailableAuthAdapter: AuthAdapter = {
  available: false,
  async getCurrentUser() {
    return null;
  },
  onAuthStateChange() {
    return () => undefined;
  },
  async signIn() {
    throw new CloudUnavailableError();
  },
  async signUp() {
    throw new CloudUnavailableError();
  },
  async signOut() {
    throw new CloudUnavailableError();
  },
};
