import { watchlistApi } from '@/api';
import { useAsyncState } from '@vueuse/core';

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

  return {
    state,
    isLoading,
    error,
    refetchWatchlist,
  };
}
