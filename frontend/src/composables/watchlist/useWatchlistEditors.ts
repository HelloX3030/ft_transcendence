import { useAsyncState } from '@vueuse/core';
import { userApi } from '@/api/endpoints/user';

export function useWatchlistEditors(editorIds: number[]) {
  const {
    state: editors,
    isLoading: editorsLoading,
    error: editorsError,
    execute: fetchEditors,
  } = useAsyncState(() => Promise.all(editorIds.map((id) => userApi.getById(id))), []);

  return { editors, editorsLoading, editorsError, fetchEditors };
}
