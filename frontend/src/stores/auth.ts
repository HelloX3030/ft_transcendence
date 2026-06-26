import { ref } from 'vue';
import { defineStore } from 'pinia';

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  const first = Array.isArray(body?.message) ? body.message[0] : body?.message;
  const message = typeof first === 'string' ? first : 'Something went wrong. Please try again.';
  throw Object.assign(new Error(message), { status: res.status });
}

interface AuthUser {
  id: number;
  username: string;
  email: string;
  image: string | null;
  language: 'de' | 'en' | 'es';
  role: 'admin' | 'user';
  genreIds: number[];
  actorIds: number[];
  directorIds: number[];
}

type UpdateUserPayload = Pick<AuthUser, 'username' | 'email' | 'language'>;

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  language: string;
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

  async function login(payload: LoginPayload) {
    const res = await fetch('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwApiError(res);
    isLoggedIn.value = true;
    await fetchUser();
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

  async function register(payload: RegisterPayload) {
    const res = await fetch('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwApiError(res);
    isLoggedIn.value = true;
    requiresOnboarding.value = true;
    await fetchUser();
  }

  async function completeOnboarding() {
    requiresOnboarding.value = false;
    await fetchUser();
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

  async function updateUser(payload: Partial<UpdateUserPayload>) {
    const res = await fetch('/v1/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!res.ok) await throwApiError(res);
    user.value = await res.json();
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
  };
});
