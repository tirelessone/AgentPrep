import type { AuthAdapter } from './auth';
import { unavailableAuthAdapter } from './auth';
import { SupabaseCloudStudyStore } from './cloud-store';
import { getSupabaseClient } from './supabase';
import { SupabaseAuthAdapter } from './supabase-auth';
import type { CloudStudyStore } from './types';

export interface CloudRuntime {
  auth: AuthAdapter;
  createStudyStore(userId: string): CloudStudyStore | null;
}

export const unavailableCloudRuntime: CloudRuntime = {
  auth: unavailableAuthAdapter,
  createStudyStore() {
    return null;
  },
};

export async function loadCloudRuntime(): Promise<CloudRuntime> {
  const client = await getSupabaseClient();
  if (!client) return unavailableCloudRuntime;
  return {
    auth: new SupabaseAuthAdapter(client),
    createStudyStore(userId) {
      return new SupabaseCloudStudyStore(client, userId);
    },
  };
}
