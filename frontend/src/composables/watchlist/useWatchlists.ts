import { useAsyncState } from '@vueuse/core';
import { watchlistApi } from '@/api/endpoints/watchlist';

export function useWatchlists() {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchWatchlists,
  } = useAsyncState(() => watchlistApi.getAll(), null);

  return { state, isLoading, isReady, error, refetchWatchlists };
}
