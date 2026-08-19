import { userApi } from '@/api/endpoints/user';
import type { UploadOptions } from '@/api/upload';
import type { UpdateUserRequest, UserMeResponse } from '@cinemates/shared';
import { logger } from '@/lib/logger';
import { useAsyncState } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  let generation = 0;

  const {
    state,
    isLoading,
    isReady,
    error,
    execute: executeRefetchUser,
  } = useAsyncState<UserMeResponse | null>(
    async () => {
      const requestGeneration = generation;
      try {
        const user = await userApi.getMe();
        return requestGeneration === generation ? user : null;
      } catch (error) {
        if (requestGeneration !== generation) return null;
        throw error;
      }
    },
    null,
    {
      immediate: false,
      // Without this vueuse falls through to globalThis.reportError, which
      // announces a failure already captured in `error` as though it were an
      // uncaught exception.
      onError: (error) => logger.debug('[user] failed to load', error),
    },
  );

  async function refetchUser() {
    return executeRefetchUser();
  }

  const requiresOnboarding = computed(() => {
    if (!isReady.value) return false;
    return !state.value!.onboardingCompleted;
  });

  async function uploadAvatar(file: File, opts?: UploadOptions) {
    const formData = new FormData();
    formData.append('file', file);
    // Awaited, so refetchUser() reads the new avatar rather than racing the
    // upload, and a rejection reaches the caller instead of going unhandled.
    await userApi.uploadAvatar(formData, opts);
    await refetchUser();
  }

  async function deleteAvatar() {
    await userApi.deleteAvatar();
    await refetchUser();
  }

  async function updateUser(payload: UpdateUserRequest) {
    await userApi.update(payload);
    await refetchUser();
  }

  async function completeOnboarding(movieIds: number[]) {
    // No refetch: the endpoint answers with the updated user, which is the same
    // row refetchUser() would go and get.
    state.value = await userApi.onboarding(movieIds);
  }

  async function activateTotp(otp: string) {
    await userApi.activateTotp(otp);
    await refetchUser();
  }

  async function deleteTotp(otp: string) {
    await userApi.deleteTotp(otp);
    await refetchUser();
  }

  function $reset() {
    generation++;
    state.value = null;
    isReady.value = false;
    error.value = null;
  }

  return {
    state,
    requiresOnboarding,
    isReady,
    isLoading,
    error,
    refetchUser,
    uploadAvatar,
    deleteAvatar,
    updateUser,
    completeOnboarding,
    activateTotp,
    deleteTotp,
    $reset,
  };
});
