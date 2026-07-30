import { userApi } from '@/api/endpoints/user';
import type { UpdateUserRequest, UserMeResponse } from '@trailertinder/shared';
import { useAsyncState } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  const {
    state,
    isLoading,
    isReady,
    error,
    execute: refetchUser,
  } = useAsyncState<UserMeResponse | null>(() => userApi.getMe(), null, {
    immediate: false,
  });

  const requiresOnboarding = computed(() => {
    if (!isReady.value) return false;
    return !state.value!.onboardingCompleted;
  });

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    // Awaited, so refetchUser() reads the new avatar rather than racing the
    // upload, and a rejection reaches the caller instead of going unhandled.
    await userApi.uploadAvatar(formData);
    await refetchUser();
  }

  async function updateUser(payload: UpdateUserRequest) {
    await userApi.update(payload);
    await refetchUser();
  }

  async function completeOnboarding(movieIds: number[]) {
    await userApi.onboarding(movieIds);
    await refetchUser();
  }

  async function activateTotp(otp: string) {
    await userApi.activateTotp(otp);
    await refetchUser();
  }

  async function deleteTotp() {
    await userApi.deleteTotp();
    await refetchUser();
  }

  function $reset() {
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
    updateUser,
    completeOnboarding,
    activateTotp,
    deleteTotp,
    $reset,
  };
});
