import type { AgentPrepDatabase } from '../db';
import { rebuildReviewsFromAttempts } from '../study-service';
import { mergeAttempts, mergeFavorites, mergeSettings } from './merge';
import {
  favoriteStateSchema,
  isSyncableSetting,
  localSettingSchema,
  studyAttemptSchema,
  type CloudStudyStore,
  type ReconcileResult,
} from './types';

export async function reconcileStudyState(
  database: AgentPrepDatabase,
  cloudStore: CloudStudyStore,
): Promise<ReconcileResult> {
  const [
    localAttempts,
    localFavorites,
    allLocalSettings,
    remoteAttempts,
    remoteFavorites,
    remoteSettings,
  ] = await Promise.all([
    database.attempts.toArray(),
    database.favorites.toArray(),
    database.settings.toArray(),
    cloudStore.fetchAttempts(),
    cloudStore.fetchFavorites(),
    cloudStore.fetchSettings(),
  ]);

  const cloudAttempts = studyAttemptSchema.array().parse(remoteAttempts);
  const cloudFavorites = favoriteStateSchema.array().parse(remoteFavorites);
  const cloudSettings = localSettingSchema.array().parse(remoteSettings).filter(isSyncableSetting);
  const localSettings = allLocalSettings.filter(isSyncableSetting);

  const attempts = mergeAttempts(localAttempts, cloudAttempts);
  const favorites = mergeFavorites(localFavorites, cloudFavorites);
  const settings = mergeSettings(localSettings, cloudSettings);
  const reviews = rebuildReviewsFromAttempts(attempts.merged);

  await database.transaction(
    'rw',
    [database.attempts, database.favorites, database.reviews, database.settings],
    async () => {
      await database.attempts.bulkPut(attempts.merged);
      await database.favorites.bulkPut(favorites.merged);
      await database.settings.bulkPut(settings.merged);
      await database.reviews.clear();
      await database.reviews.bulkPut(reviews);
    },
  );

  await Promise.all([
    attempts.toCloud.length > 0 ? cloudStore.upsertAttempts(attempts.toCloud) : Promise.resolve(),
    favorites.toCloud.length > 0
      ? cloudStore.upsertFavorites(favorites.toCloud)
      : Promise.resolve(),
    settings.toCloud.length > 0 ? cloudStore.upsertSettings(settings.toCloud) : Promise.resolve(),
  ]);

  return {
    attempts: attempts.merged.length,
    favorites: favorites.merged.length,
    settings: settings.merged.length,
    pushed: {
      attempts: attempts.toCloud.length,
      favorites: favorites.toCloud.length,
      settings: settings.toCloud.length,
    },
    warnings: attempts.warnings,
  };
}

export class SyncCoordinator {
  private inFlight: Promise<ReconcileResult> | undefined;

  reconcile(database: AgentPrepDatabase, cloudStore: CloudStudyStore) {
    this.inFlight ??= reconcileStudyState(database, cloudStore).finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
}
