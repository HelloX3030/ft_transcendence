import { ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UserMeResponse,
} from '@trailertinder/shared';
import { authApi } from '@/api/endpoints/auth';
import { useUserStore } from './user';
import { notifyStore } from './notify';

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const notify = notifyStore();
  const user = ref<UserMeResponse | null | undefined>(null);

  async function init() {
    try {
      await authApi.session();
      isLoggedIn.value = true;
    } catch {
      // network error — stay logged out
    }
  }

  // Like register(), errors bubble: useLogin turns them into errorMessage.
  async function login(payload: LoginRequest): Promise<LoginResponse | null> {
    const result = await authApi.login(payload);
    if (!result?.mfaRequired) {
      isLoggedIn.value = true;
      const userStore = useUserStore();
      await userStore.refetchUser();
      notify.init();
    }
    return result;
  }

  async function logout() {
    try {
      await authApi.logout();
      notify.stop();
      isLoggedIn.value = false;
    } catch {
      // best-effort — clear local state regardless
    }
  }

  // Errors bubble to the caller: SignupForm needs them to render errorMessage.
  async function register(payload: RegisterRequest) {
    await authApi.register(payload);
    isLoggedIn.value = true;
    const userStore = useUserStore();
    await userStore.refetchUser();
    notify.init();
  }

  return {
    isLoggedIn,
    init,
    login,
    logout,
    register,
  };
});
