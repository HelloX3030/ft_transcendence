import { useAsyncState } from '@vueuse/core';
import { userApi } from '@/api/endpoints/user';
import { logger } from '@/lib/logger';
import { toValue, watch, type MaybeRefOrGetter } from 'vue';

export function useUserDetails(userIds: MaybeRefOrGetter<number[]>) {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchUserDetails,
  } = useAsyncState(() => Promise.all(toValue(userIds).map((id) => userApi.getById(id))), [], {
    // vueuse's default onError is globalThis.reportError, which announces a
    // failure already captured in `error` as though it were uncaught.
    onError: (error) => logger.debug('[user-details] failed to load', error),
  });

  watch(
    () => toValue(userIds),
    (value) => {
      if (value.length > 0) refetchUserDetails();
    },
  );

  return { state, isLoading, isReady, error, refetchUserDetails };
}
