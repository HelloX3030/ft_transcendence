import { watchlistApi } from '@/api';
import { logger } from '@/lib/logger';
import { useWatchlistsStore } from '@/stores/watchlists';
import { useAsyncState } from '@vueuse/core';
import { watch } from 'vue';

export function useWatchlist(
  watchlistId: number,
  options: { immediate?: boolean } = { immediate: true },
) {
  const {
    state,
    isLoading,
    error,
    execute: refetchWatchlist,
  } = useAsyncState(() => watchlistApi.getById(watchlistId), null, {
    ...options,
    // Handled: `error` is rendered by the view. Without this vueuse also
    // reports it through globalThis.reportError, as an uncaught exception.
    onError: (error) => logger.debug('[watchlist] failed to load', error),
  });

  const watchlists = useWatchlistsStore();
  watch(
    () => watchlists.version,
    () => void refetchWatchlist(),
  );

  return {
    state,
    isLoading,
    error,
    refetchWatchlist,
  };
}
