import { watchlistApi } from '@/api';
import { useAsyncState } from '@vueuse/core';

export function useWatchlist(watchlistId: number) {
  const {
    state: watchlist,
    isLoading: watchlistLoading,
    error: watchlistError,
    execute: refetchWatchlist,
  } = useAsyncState(() => watchlistApi.getById(watchlistId), null);

  return {
    watchlist,
    watchlistLoading,
    watchlistError,
    refetchWatchlist,
  };
}
