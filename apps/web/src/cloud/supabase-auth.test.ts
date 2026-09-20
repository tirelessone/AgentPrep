// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseAuthAdapter } from './supabase-auth';

function createClient() {
  const signUp = vi.fn(async () => ({
    data: { user: null, session: null },
    error: null,
  }));
  return {
    client: { auth: { signUp } } as unknown as SupabaseClient,
    signUp,
  };
}

describe('Supabase signup redirects', () => {
  const credentials = { email: 'learner@example.com', password: 'password123' };

  it('keeps the browser origin redirect for the Web build', async () => {
    const { client, signUp } = createClient();
    await new SupabaseAuthAdapter(client, 'web').signUp(credentials);

    expect(signUp).toHaveBeenCalledWith({
      ...credentials,
      options: { emailRedirectTo: window.location.origin },
    });
  });

  it('does not send a Tauri custom origin as emailRedirectTo', async () => {
    const { client, signUp } = createClient();
    await new SupabaseAuthAdapter(client, 'desktop').signUp(credentials);

    expect(signUp).toHaveBeenCalledWith(credentials);
  });
});
