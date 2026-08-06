import { ref, watch, type Ref } from 'vue';
import type { MovieWatchProviders, WatchProvider } from '@cinemates/shared';
import { DEFAULT_REGION } from '@/lib/constants';
import { backendClient } from '@/api';
import { logger } from '@/lib/logger';

/**
 * Fetches the DEFAULT_REGION flatrate (subscription) providers for a movie,
 * refetching whenever the id changes. Returns an empty list on error or when the
 * region/flatrate is missing, so callers can simply hide the section when empty.
 */
export function useWatchProviders(movieId: Ref<number | undefined>) {
  const providers = ref<WatchProvider[]>([]);

  // Bumped per (re)load: a slower stale response (id changed mid-flight) sees a
  // stale token and drops its result instead of overwriting the current list.
  let generation = 0;

  watch(
    movieId,
    async (id) => {
      const gen = ++generation;
      providers.value = [];
      if (id == null || Number.isNaN(id)) return;
      try {
        const data = await backendClient<MovieWatchProviders>(`/tmdb/movies/${id}/providers`);
        if (gen !== generation) return;
        providers.value = data.results?.[DEFAULT_REGION]?.flatrate ?? [];
      } catch (error) {
        if (gen !== generation) return;
        logger.error(error);
      }
    },
    { immediate: true },
  );

  return { providers };
}
