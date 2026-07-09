import { ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UpdateUserRequest,
  UserMeResponse,
} from '@trailertinder/shared';

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const first = Array.isArray(body?.message) ? body.message[0] : body?.message;
  const message = typeof first === 'string' ? first : 'Something went wrong. Please try again.';
  throw Object.assign(new Error(message), { status: res.status });
}

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);
  const requiresOnboarding = ref(false);
  const user = ref<UserMeResponse | null>(null);

  // Onboarding state is owned by the backend (users.onboardingCompleted). Mirror it
  // locally whenever we (re)load the user so a page reload or a login from another
  // device can't bypass onboarding.
  function syncOnboarding() {
    requiresOnboarding.value = user.value ? !user.value.onboardingCompleted : false;
  }

  async function fetchUser() {
    try {
      const res = await fetch('/v1/users/me', { credentials: 'same-origin' });
      if (res.ok) {
        user.value = await res.json();
        syncOnboarding();
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

  async function login(payload: LoginRequest): Promise<LoginResponse> {
    const res = await fetch('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwApiError(res);
    const body = await res.json();
    const result = body.data as LoginResponse;

    if (!result.mfaRequired) {
      isLoggedIn.value = true;
      await fetchUser();
    }

    return result;
  }

  async function logout() {
    try {
      await fetch('/v1/auth/logout', { credentials: 'same-origin' });
    } catch {
      // best-effort — clear local state regardless
    }
    isLoggedIn.value = false;
    requiresOnboarding.value = false;
    user.value = null;
  }

  async function register(payload: RegisterRequest) {
    const res = await fetch('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwApiError(res);
    isLoggedIn.value = true;
    // requiresOnboarding is derived from the fetched user (onboardingCompleted=false
    // for a new account), so no need to set it manually here.
    await fetchUser();
  }

  // Sends the movies picked during onboarding to the backend, which marks
  // onboarding complete and returns the updated user.
  async function completeOnboarding(movieIds: number[]) {
    const res = await fetch('/v1/users/me/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ movieIds }),
    });
    if (!res.ok) await throwApiError(res);
    user.value = await res.json();
    syncOnboarding();
  }

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/v1/users/me/avatar', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });
    if (!res.ok) await throwApiError(res);
    await fetchUser();
  }

  async function updateUser(payload: UpdateUserRequest) {
    const res = await fetch('/v1/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwApiError(res);
    user.value = await res.json();
    syncOnboarding();
  }

  async function setupTotp(): Promise<string> {
    const res = await fetch('/v1/users/mfa/totp/setup', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) await throwApiError(res);
    const body = await res.json();
    return body.data as string; // SVG-Markup as string
  }

  async function activateTotp(otp: string) {
    const res = await fetch('/v1/users/mfa/totp/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ otp }),
    });
    if (!res.ok) await throwApiError(res);
  }

  async function deleteTotp() {
    const res = await fetch('/v1/users/mfa/totp', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) await throwApiError(res);
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
    fetchUser,
    updateUser,
    uploadAvatar,
    setupTotp,
    activateTotp,
    deleteTotp,
  };
});
