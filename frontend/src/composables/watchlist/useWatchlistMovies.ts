import { watchlistApi } from '@/api';
import { logger } from '@/lib/logger';
import { useWatchlistsStore } from '@/stores/watchlists';
import { useAsyncState } from '@vueuse/core';
import { watch } from 'vue';

export function useWatchlistMovies(
  watchlistId: number,
  options: { immediate?: boolean } = { immediate: true },
) {
  const {
    state: movies,
    isLoading: moviesLoading,
    error: moviesError,
    execute: refetchMovies,
  } = useAsyncState(() => watchlistApi.getMoviesById(watchlistId), [], {
    ...options,
    // Handled: `moviesError` is rendered by the view. Without this vueuse also
    // reports it through globalThis.reportError, as an uncaught exception.
    onError: (error) => logger.error('[watchlist-movies] failed to load', error),
  });

  const watchlists = useWatchlistsStore();
  watch(
    () => watchlists.version,
    () => void refetchMovies(),
  );

  return {
    movies,
    moviesLoading,
    moviesError,
    refetchMovies,
  };
}
