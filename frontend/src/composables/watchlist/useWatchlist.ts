import { watchlistApi } from '@/api';
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
  } = useAsyncState(() => watchlistApi.getById(watchlistId), null, options);

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
