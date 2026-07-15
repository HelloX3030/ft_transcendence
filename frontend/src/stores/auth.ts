import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { LoginRequest, LoginResponse, RegisterRequest } from '@trailertinder/shared';
import { authApi } from '@/api/endpoints/auth';
import { useUserStore } from './user';

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);

  async function init() {
    try {
      await authApi.session();
      isLoggedIn.value = true;
    } catch {
      // network error — stay logged out
    }
  }

  async function login(payload: LoginRequest): Promise<LoginResponse | null> {
    try {
      const result = await authApi.login(payload);
      if (!result?.mfaRequired) {
        isLoggedIn.value = true;
        const userStore = useUserStore();
        await userStore.refetchUser();
      }
      return result;
    } catch (error) {
      throw error; //TODO: modify Backend Error message for ui
    }
  }

  async function logout() {
    try {
      await authApi.logout();
      isLoggedIn.value = false;
    } catch {
      // best-effort — clear local state regardless
    }
  }

  async function register(payload: RegisterRequest) {
    try {
      await authApi.register(payload);
      isLoggedIn.value = true;
      const userStore = useUserStore();
      await userStore.refetchUser();
    } catch (error) {}
  }

  return {
    isLoggedIn,
    init,
    login,
    logout,
    register,
  };
});
