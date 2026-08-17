import { ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  LoginRequest,
  LoginResponse,
  MfaVerifyRequest,
  RegisterRequest,
} from '@cinemates/shared';
import { authApi } from '@/api/endpoints/auth';
import { useUserStore } from './user';
import { useNotifyStore } from './notify';
import { resetAllStores } from './plugins/resetPlugin';
import { broadcastLogin, broadcastLogout } from '@/lib/session-signals';

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false);

  // The notify store is resolved where it is used, not here. Resolving it in
  // the setup body made `useAuthStore()` build the notify, chat and friends
  // stores with it — and the friends store used to fetch on creation, so
  // main.ts's first line issued an authenticated request before init() had run.
  // Keeping the lookups local means a store is only built when something
  // actually needs it.

  async function init() {
    try {
      const session = await authApi.session();
      isLoggedIn.value = session.authenticated;
    } catch {
      // A genuine network failure — the endpoint answers 200 either way now, so
      // "nobody is signed in" no longer arrives here. Stay logged out.
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
    useNotifyStore().init();
    // Only the paths that *establish* a session run through here — a reload
    // rebuilds its state in main.ts without it — so the other tabs are told
    // exactly once, by the tab that changed what the browser holds. Announcing
    // it on boot instead would have every corrected tab correct the others.
    //
    // Nothing to announce without an id: the refetch is what failed, and a tab
    // that cannot say who it is has no business telling other tabs who they are.
    const userId = userStore.state?.id;
    if (userId !== undefined) broadcastLogin(userId);
  }

  // Second step of an MFA login. Takes the challenge token from login(), not the
  // password — that is deliberately not kept around. On the Google path the
  // token is omitted entirely and the backend reads it from a cookie instead.
  async function verifyMfa(payload: MfaVerifyRequest) {
    await authApi.verifyMfa(payload);
    await startSession();
  }

  /**
   * Tail of an OAuth login. The session cookies were set by the backend during
   * the redirect, so there is nothing to send — this only confirms they work
   * before treating the user as logged in.
   *
   * Returns false when they do not, which is how the callback view tells a
   * silently dropped cookie from a successful sign-in.
   */
  async function completeOAuthLogin(): Promise<boolean> {
    await init();
    if (!isLoggedIn.value) return false;
    await startSession();
    return true;
  }

  /**
   * Tears down everything the session left behind locally. Split out because a
   * password reset ends the session server-side too, and has nothing to log out
   * of by the time it gets here.
   */
  function clearSession() {
    useNotifyStore().stop();
    // Drops isLoggedIn along with every other store's state, so nothing from
    // the old session survives into the next one.
    resetAllStores();
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // The server-side session may already be gone — swept, or ended from
      // another tab. Local state must go either way, or the UI keeps rendering
      // a session that no longer exists.
    } finally {
      clearSession();
      // Fires even when the request failed: the cookies are cleared client-side
      // either way, so the other tabs are just as dead and must be told. Not in
      // clearSession(), which the password-reset path also calls from a context
      // that never had a session to end.
      broadcastLogout();
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
    completeOAuthLogin,
    clearSession,
    logout,
    register,
    $reset,
  };
});
