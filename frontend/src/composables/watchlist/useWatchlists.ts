import { useAsyncState } from '@vueuse/core';
import { watch } from 'vue';
import { watchlistApi } from '@/api/endpoints/watchlist';
import { useWatchlistsStore } from '@/stores/watchlists';

export function useWatchlists() {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchWatchlists,
  } = useAsyncState(() => watchlistApi.getAll(), null);

  // A watchlist event raised by another member invalidates this list.
  const watchlists = useWatchlistsStore();
  watch(
    () => watchlists.version,
    () => void refetchWatchlists(),
  );

  return { state, isLoading, isReady, error, refetchWatchlists };
}
