import { watchlistApi } from '@/api';
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
  } = useAsyncState(() => watchlistApi.getMoviesById(watchlistId), [], options);

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
