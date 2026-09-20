import type { FavoriteQuestion, LocalSetting, StudyAttempt } from '@agentprep/domain';

import type { SyncWarning } from './types';

function payloadMatches(left: StudyAttempt, right: StudyAttempt) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isLater(left: string, right: string) {
  return Date.parse(left) > Date.parse(right);
}

export function mergeAttempts(
  localAttempts: readonly StudyAttempt[],
  cloudAttempts: readonly StudyAttempt[],
) {
  const merged = new Map(cloudAttempts.map((attempt) => [attempt.id, attempt]));
  const toCloud: StudyAttempt[] = [];
  const warnings: SyncWarning[] = [];

  localAttempts.forEach((localAttempt) => {
    const cloudAttempt = merged.get(localAttempt.id);
    if (!cloudAttempt) {
      merged.set(localAttempt.id, localAttempt);
      toCloud.push(localAttempt);
      return;
    }
    if (!payloadMatches(localAttempt, cloudAttempt)) {
      warnings.push({
        kind: 'attempt-payload-conflict',
        id: localAttempt.id,
        message: `Attempt ${localAttempt.id} exists with different payloads; cloud was preserved.`,
      });
    }
  });

  return {
    merged: [...merged.values()].sort(
      (left, right) =>
        left.attemptedAt.localeCompare(right.attemptedAt) || left.id.localeCompare(right.id),
    ),
    toCloud,
    warnings,
  };
}

function mergeLatestByKey<T>(
  localItems: readonly T[],
  cloudItems: readonly T[],
  keyOf: (item: T) => string,
  updatedAtOf: (item: T) => string,
) {
  const merged = new Map(cloudItems.map((item) => [keyOf(item), item]));
  const toCloud: T[] = [];

  localItems.forEach((localItem) => {
    const key = keyOf(localItem);
    const cloudItem = merged.get(key);
    if (!cloudItem || isLater(updatedAtOf(localItem), updatedAtOf(cloudItem))) {
      merged.set(key, localItem);
      toCloud.push(localItem);
    }
  });

  return { merged: [...merged.values()], toCloud };
}

export function mergeFavorites(
  localFavorites: readonly FavoriteQuestion[],
  cloudFavorites: readonly FavoriteQuestion[],
) {
  return mergeLatestByKey(
    localFavorites,
    cloudFavorites,
    (favorite) => favorite.questionId,
    (favorite) => favorite.updatedAt,
  );
}

export function mergeSettings(
  localSettings: readonly LocalSetting[],
  cloudSettings: readonly LocalSetting[],
) {
  return mergeLatestByKey(
    localSettings,
    cloudSettings,
    (setting) => setting.key,
    (setting) => setting.updatedAt,
  );
}
