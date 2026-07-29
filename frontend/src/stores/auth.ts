import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { LoginRequest, LoginResponse, RegisterRequest } from '@trailertinder/shared';
import { authApi } from '@/api/endpoints/auth';
import { useUserStore } from './user';
import { useNotifyStore } from './notify';
import { resetAllStores } from './plugins/resetPlugin';

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
        await useUserStore().refetchUser();
        useNotifyStore().init();
      }
      return result;
    } catch (error) {
      throw error; //TODO: modify Backend Error message for ui
    }
  }

  async function logout() {
    try {
      await authApi.logout();
      useNotifyStore().stop();
      resetAllStores();
    } catch {
      // best-effort — clear local state regardless
    }
  }

  async function register(payload: RegisterRequest) {
    try {
      await authApi.register(payload);
      isLoggedIn.value = true;
      await useUserStore().refetchUser();
      useNotifyStore().init();
    } catch (error) {}
  }

  function $reset() {
    isLoggedIn.value = false;
  }

  return {
    isLoggedIn,
    init,
    login,
    logout,
    register,
    $reset,
  };
});
