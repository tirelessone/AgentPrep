import type { AgentPrepDatabase } from '../db';
import { rebuildReviewsFromAttempts } from '../study-service';
import { mergeAttempts, mergeFavorites, mergeSettings } from './merge';
import { isSyncableSetting } from './types';

export async function hasLocalStudyData(database: AgentPrepDatabase) {
  const [attempts, favorites, settings, reviews] = await Promise.all([
    database.attempts.count(),
    database.favorites.count(),
    database.settings.count(),
    database.reviews.count(),
  ]);
  return attempts + favorites + settings + reviews > 0;
}

export async function mergeLocalStudyData(source: AgentPrepDatabase, target: AgentPrepDatabase) {
  const [
    sourceAttempts,
    sourceFavorites,
    sourceSettings,
    targetAttempts,
    targetFavorites,
    targetSettings,
  ] = await Promise.all([
    source.attempts.toArray(),
    source.favorites.toArray(),
    source.settings.toArray(),
    target.attempts.toArray(),
    target.favorites.toArray(),
    target.settings.toArray(),
  ]);

  // Treat the account cache as authoritative for the impossible UUID collision case.
  const attempts = mergeAttempts(sourceAttempts, targetAttempts);
  const favorites = mergeFavorites(sourceFavorites, targetFavorites);
  const settings = mergeSettings(
    sourceSettings.filter(isSyncableSetting),
    targetSettings.filter(isSyncableSetting),
  );
  const reviews = rebuildReviewsFromAttempts(attempts.merged);

  await target.transaction(
    'rw',
    [target.attempts, target.favorites, target.reviews, target.settings],
    async () => {
      await target.attempts.bulkPut(attempts.merged);
      await target.favorites.bulkPut(favorites.merged);
      await target.settings.bulkPut(settings.merged);
      await target.reviews.clear();
      await target.reviews.bulkPut(reviews);
    },
  );

  return { warnings: attempts.warnings };
}
