import { watchlistApi } from '@/api';
import { userApi } from '@/api/endpoints/user';
import { useAsyncState } from '@vueuse/core';
import { watch } from 'vue';

export function useWatchlist(watchlistId: number) {
  const {
    state: movies,
    isLoading: moviesLoading,
    error: moviesError,
  } = useAsyncState(() => watchlistApi.getMoviesById(watchlistId), []);

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
    movies,
    moviesLoading,
    moviesError,
    editors,
    editorsLoading,
    editorsError,
  };
}
