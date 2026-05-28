import { ref } from 'vue';
import { defineStore } from 'pinia';

interface AuthUser {
  id: number;
  username: string;
  email: string;
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const requiresOnboarding = ref(false);
  const user = ref<AuthUser | null>(null);

  async function init() {
    try {
      const res = await fetch('/v1/auth/me');
      if (res.ok) {
        isLoggedIn.value = true;
      }
    } catch {
      // network error — stay logged out
    }
  }

  function login() {
    isLoggedIn.value = true;
  }

  async function logout() {
    await fetch('/v1/auth/logout', { credentials: 'same-origin' });
    isLoggedIn.value = false;
    requiresOnboarding.value = false;
    user.value = null;
  }

  function register() {
    isLoggedIn.value = true;
    requiresOnboarding.value = true;
  }

  function completeOnboarding() {
    requiresOnboarding.value = false;
  }

  return {
    isLoggedIn,
    requiresOnboarding,
    user,
    init,
    login,
    logout,
    register,
    completeOnboarding,
  };
});
