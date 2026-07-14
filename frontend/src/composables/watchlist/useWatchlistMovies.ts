import { watchlistApi } from '@/api';
import { useAsyncState } from '@vueuse/core';

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

  return {
    movies,
    moviesLoading,
    moviesError,
    refetchMovies,
  };
}
