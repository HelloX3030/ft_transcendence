import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { TmdbGenre } from '@cinemates/shared';
import { backendClient } from '@/api';
import { logger } from '@/lib/logger';

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

// The TMDB genre catalogue (id -> name). It's small and near-static, so it's
// fetched once per session and shared app-wide, replacing the old hardcoded map.
export const useGenresStore = defineStore('genres', () => {
  const genres = ref<TmdbGenre[]>([]);
  const status = ref<FetchStatus>('idle');

  // De-dupes concurrent callers (many movie cards mount at once) onto one request.
  let inFlight: Promise<void> | null = null;

  // id -> name lookup, rebuilt when the list changes.
  const genreMap = computed(
    () => Object.fromEntries(genres.value.map((g) => [g.id, g.name])) as Record<number, string>,
  );

  function genreName(id: number): string | undefined {
    return genreMap.value[id];
  }

  // Idempotent: fetches at most once. A previous failure leaves status 'error'
  // (not 'ready'), so a later call retries.
  function ensureLoaded(): Promise<void> {
    if (status.value === 'ready') return Promise.resolve();
    if (inFlight) return inFlight;
    status.value = 'loading';
    inFlight = backendClient<TmdbGenre[]>('/tmdb/genres')
      .then((data) => {
        genres.value = data;
        status.value = 'ready';
      })
      .catch((error) => {
        logger.error(error);
        status.value = 'error';
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }
  function $reset() {
    genres.value = [];
    status.value = 'idle';
    inFlight = null;
  }
  return { genres, status, genreMap, genreName, ensureLoaded, $reset };
});
