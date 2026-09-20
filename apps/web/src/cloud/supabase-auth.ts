import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { AuthAdapter, AuthUser, SignUpCredentials } from './auth';

function toAuthUser(user: User): AuthUser {
  if (!user.email) throw new Error('Supabase user is missing an email address.');
  return { id: user.id, email: user.email };
}

export class SupabaseAuthAdapter implements AuthAdapter {
  readonly available = true;

  constructor(private readonly client: SupabaseClient) {}

  async getCurrentUser() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session ? toAuthUser(data.session.user) : null;
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(session ? toAuthUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(credentials: SignUpCredentials) {
    const { data, error } = await this.client.auth.signInWithPassword(credentials);
    if (error) throw new Error(error.message);
    return toAuthUser(data.user);
  }

  async signUp(credentials: SignUpCredentials) {
    const { data, error } = await this.client.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    return {
      user: data.user ? toAuthUser(data.user) : null,
      requiresEmailConfirmation: data.session === null,
    };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  }
}
