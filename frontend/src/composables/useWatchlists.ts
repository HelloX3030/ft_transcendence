import { useAsyncState } from '@vueuse/core';
import { watchlistApi } from '@/api/endpoints/watchlist';

export function useWatchlists() {
  const {
    state: watchlists,
    isLoading: watchlistsLoading,
    isReady: watchlistsReady,
    error: watchlistsError,
  } = useAsyncState(() => watchlistApi.getAll(), null);

  return { watchlists, watchlistsLoading, watchlistsReady, watchlistsError };
}
