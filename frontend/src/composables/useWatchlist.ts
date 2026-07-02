import { watchlistApi } from '@/api';
import { userApi } from '@/api/endpoints/user';
import { useAsyncState } from '@vueuse/core';
import { watch } from 'vue';

export function useWatchlist(watchlistId: number) {
  const {
    state: movieIds,
    isLoading: movieIdsLoading,
    error: movieIdsError,
  } = useAsyncState(() => watchlistApi.getMovieIdsById(watchlistId), []);

  const {
    state: watchlist,
    isLoading: watchlistLoading,
    error: watchlistError,
  } = useAsyncState(() => watchlistApi.getById(watchlistId), null);

  const {
    state: editors,
    isLoading: editorsLoading,
    error: editorsError,
    execute: fetchEditors,
  } = useAsyncState(
    () => Promise.all(watchlist.value!.editorIds.map((id) => userApi.getById(id))),
    null,
    { immediate: false },
  );

  watch(watchlist, (list) => {
    if (!list?.editorIds?.length) return;
    fetchEditors();
  });

  return {
    watchlist,
    watchlistLoading,
    watchlistError,
    movieIds,
    movieIdsLoading,
    movieIdsError,
    editors,
    editorsLoading,
    editorsError,
  };
}
