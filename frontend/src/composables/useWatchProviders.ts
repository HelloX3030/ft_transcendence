import { onScopeDispose, ref, watch, type Ref } from 'vue';
import type { MovieWatchProviders, WatchProvider } from '@cinemates/shared';
import { WATCH_PROVIDER_REGION } from '@/lib/constants';
import { backendClient } from '@/api';
import { logger } from '@/lib/logger';

/**
 * How long the id has to hold still before it is worth a request.
 *
 * The feed changes this on every swipe, and a request per swipe is a request
 * per card skimmed past — enough of them in a row to trip the API throttler,
 * after which the providers stop appearing on the cards the user does stop on.
 * Cards passed through in under this are never asked about.
 */
const SETTLE_MS = 300;

/**
 * Fetches the WATCH_PROVIDER_REGION flatrate (subscription) providers for a
 * movie, refetching once the id has settled. Returns an empty list on error or
 * when the region/flatrate is missing, so callers can simply hide the section
 * when empty — which is what a user outside that region sees.
 */
export function useWatchProviders(movieId: Ref<number | undefined>) {
  const providers = ref<WatchProvider[]>([]);

  // Bumped per (re)load: a slower stale response (id changed mid-flight) sees a
  // stale token and drops its result instead of overwriting the current list.
  let generation = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    movieId,
    async (id) => {
      const gen = ++generation;
      providers.value = [];
      if (settleTimer !== null) clearTimeout(settleTimer);
      if (id == null || Number.isNaN(id)) return;

      // Wait out the swipe before spending a request on this card.
      await new Promise<void>((resolve) => {
        settleTimer = setTimeout(() => {
          settleTimer = null;
          resolve();
        }, SETTLE_MS);
      });
      if (gen !== generation) return;

      try {
        const data = await backendClient<MovieWatchProviders>(`/tmdb/movies/${id}/providers`);
        if (gen !== generation) return;
        providers.value = data.results?.[WATCH_PROVIDER_REGION]?.flatrate ?? [];
      } catch (error) {
        if (gen !== generation) return;
        logger.error(error);
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    if (settleTimer !== null) clearTimeout(settleTimer);
  });

  return { providers };
}
