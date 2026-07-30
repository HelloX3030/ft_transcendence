import { ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  RegisterRequest,
} from '@trailertinder/shared';
import { authApi } from '@/api/endpoints/auth';
import { useUserStore } from './user';
import { useNotifyStore } from './notify';
import { resetAllStores } from './plugins/resetPlugin';

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const notify = useNotifyStore();

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
    if (!result?.mfaRequired) await startSession();
    return result;
  }

  /** Shared tail of every path that ends up authenticated. */
  async function startSession() {
    isLoggedIn.value = true;
    const userStore = useUserStore();
    await userStore.refetchUser();
    notify.init();
  }

  // Second step of an MFA login. Takes the challenge token from login(), not the
  // password — that is deliberately not kept around.
  async function verifyMfa(payload: MfaVerifyRequest) {
    await authApi.verifyMfa(payload);
    await startSession();
  }

  async function logout() {
    try {
      await authApi.logout();
      notify.stop();
      // Drops isLoggedIn along with every other store's state, so nothing from
      // the old session survives into the next one.
      resetAllStores();
    } catch {
      // best-effort — clear local state regardless
    }
  }

  // Errors bubble to the caller: SignupForm needs them to render errorMessage.
  async function register(payload: RegisterRequest) {
    await authApi.register(payload);
    await startSession();
  }

  function $reset() {
    isLoggedIn.value = false;
  }

  return {
    isLoggedIn,
    init,
    login,
    verifyMfa,
    logout,
    register,
    $reset,
  };
});
