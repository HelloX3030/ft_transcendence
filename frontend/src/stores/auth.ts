import { ref } from 'vue';
import { defineStore } from 'pinia';

interface AuthUser {
  id: number;
  username: string;
  email: string;
  image: string | null;
  language: 'de' | 'en' | 'es';
  role: 'admin' | 'user';
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const requiresOnboarding = ref(false);
  const user = ref<AuthUser | null>(null);

  async function fetchUser() {
    try {
      const res = await fetch('/v1/users/me', { credentials: 'same-origin' });
      if (res.ok) {
        user.value = await res.json();
      }
    } catch {
      // network error — leave user as-is
    }
  }

  async function init() {
    try {
      const res = await fetch('/v1/auth/me');
      if (res.ok) {
        isLoggedIn.value = true;
        await fetchUser();
      }
    } catch {
      // network error — stay logged out
    }
  }

  async function login() {
    isLoggedIn.value = true;
    await fetchUser();
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

  async function completeOnboarding() {
    requiresOnboarding.value = false;
    await fetchUser();
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
