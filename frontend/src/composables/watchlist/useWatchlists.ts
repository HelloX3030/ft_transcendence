import { useAsyncState } from '@vueuse/core';
import { watch } from 'vue';
import { watchlistApi } from '@/api/endpoints/watchlist';
import { logger } from '@/lib/logger';
import { useWatchlistsStore } from '@/stores/watchlists';

export function useWatchlists() {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchWatchlists,
  } = useAsyncState(() => watchlistApi.getAll(), null, {
    // Handled: `error` is rendered by the view. Without this vueuse also
    // reports it through globalThis.reportError, as an uncaught exception.
    onError: (error) => logger.error('[watchlists] failed to load', error),
  });

  // A watchlist event raised by another member invalidates this list.
  const watchlists = useWatchlistsStore();
  watch(
    () => watchlists.version,
    () => void refetchWatchlists(),
  );

  return { state, isLoading, isReady, error, refetchWatchlists };
}
