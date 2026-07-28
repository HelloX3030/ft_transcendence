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
    try {
      await userApi.update(payload);
      await refetchUser();
    } catch (error) {
      throw error;
    }
  }

  async function completeOnboarding(movieIds: number[]) {
    try {
      await userApi.onboarding(movieIds);
      await refetchUser();
    } catch (error) {
      throw error; //TODO: do i need to catch in the first place? or just let it bubble up to the component?
    }
  }

  async function activateTotp(otp: string) {
    await userApi.activateTotp(otp);
    await refetchUser();
  }

  async function deleteTotp() {
    await userApi.deleteTotp();
    await refetchUser();
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
  };
});
