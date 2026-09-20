import type { SupabaseClient } from '@supabase/supabase-js';

import { runtimePlatform } from '../runtime';

export interface SupabaseBrowserConfig {
  url: string;
  publishableKey: string;
}

export function readSupabaseBrowserConfig(): SupabaseBrowserConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

let clientPromise: Promise<SupabaseClient | null> | undefined;

export function getSupabaseClient() {
  clientPromise ??= (async () => {
    const config = readSupabaseBrowserConfig();
    if (!config) return null;
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: runtimePlatform === 'web',
      },
    });
  })();
  return clientPromise;
}
