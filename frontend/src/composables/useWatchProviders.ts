import { ref, watch, type Ref } from 'vue';
import type { MovieWatchProviders, WatchProvider } from '@trailertinder/shared';
import { fetchData } from '@/lib/api';
import { DEFAULT_REGION } from '@/lib/constants';

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Fetches the DEFAULT_REGION flatrate (subscription) providers for a movie,
 * refetching whenever the id changes. Returns an empty list on error or when the
 * region/flatrate is missing, so callers can simply hide the section when empty.
 */
export function useWatchProviders(movieId: Ref<number | undefined>) {
  const providers = ref<WatchProvider[]>([]);
  const status = ref<FetchStatus>('idle');

  // Bumped per (re)load: a slower stale response (id changed mid-flight) sees a
  // stale token and drops its result instead of overwriting the current list.
  let generation = 0;

  watch(
    movieId,
    async (id) => {
      const gen = ++generation;
      providers.value = [];
      if (id == null || Number.isNaN(id)) {
        status.value = 'idle';
        return;
      }
      status.value = 'loading';
      try {
        const data = await fetchData<MovieWatchProviders>(`/v1/tmdb/movies/${id}/providers`);
        if (gen !== generation) return;
        providers.value = data.results[DEFAULT_REGION]?.flatrate ?? [];
        status.value = 'ready';
      } catch (error) {
        if (gen !== generation) return;
        console.error(error);
        status.value = 'error';
      }
    },
    { immediate: true },
  );

  return { providers, status };
}
