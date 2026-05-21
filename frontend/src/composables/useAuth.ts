import { ref } from 'vue';

const user = ref(null);

const isLoggedIn = ref(true);
const requiresOnboarding = ref(true);

export function useAuth() {
  function register() {
    requiresOnboarding.value = true;
  }

  function completeOnboarding() {
    requiresOnboarding.value = false;
  }

  function login() {
    isLoggedIn.value = true;
  }

  function logout() {
    isLoggedIn.value = false;
  }
  return { register, completeOnboarding, isLoggedIn, requiresOnboarding, login, logout };
}
