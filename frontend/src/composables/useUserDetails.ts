import { useAsyncState } from '@vueuse/core';
import { userApi } from '@/api/endpoints/user';
import { toValue, watch, type MaybeRefOrGetter } from 'vue';

export function useUserDetails(userIds: MaybeRefOrGetter<number[]>) {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchUserDetails,
  } = useAsyncState(() => Promise.all(toValue(userIds).map((id) => userApi.getById(id))), []);

  watch(
    () => toValue(userIds),
    (value) => {
      if (value.length > 0) refetchUserDetails();
    },
  );

  return { state, isLoading, isReady, error, refetchUserDetails };
}
