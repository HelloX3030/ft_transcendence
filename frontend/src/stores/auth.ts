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
import { cancelAccessRefresh, scheduleAccessRefresh } from '@/api/http';

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
      // A reload rebuilds the session from the cookie the browser still holds,
      // so the schedule has to be rebuilt with it — otherwise the first tab
      // reload of the day goes back to discovering expiry through a 401.
      if (session.authenticated) scheduleAccessRefresh(session.accessExpiresAt);
    } catch {
      // A genuine network failure — the endpoint answers 200 either way now, so
      // "nobody is signed in" no longer arrives here. Stay logged out.
    }
  }

  // Like register(), errors bubble: useLogin turns them into errorMessage.
  async function login(payload: LoginRequest): Promise<LoginResponse | null> {
    const result = await authApi.login(payload);
    if (!result?.mfaRequired) await startSession(result?.accessExpiresAt);
    return result;
  }

  /**
   * Shared tail of every path that ends up authenticated.
   *
   * `accessExpiresAt` comes from whichever response issued the cookie. The
   * Google path has none — it arrives by redirect and confirms the session
   * through `init()`, which schedules from `/auth/me` instead.
   */
  async function startSession(accessExpiresAt?: number) {
    isLoggedIn.value = true;
    scheduleAccessRefresh(accessExpiresAt);
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
    const result = await authApi.verifyMfa(payload);
    await startSession(result?.accessExpiresAt);
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
    // init() already scheduled the refresh off /auth/me, so startSession() is
    // called without an expiry rather than with a guess.
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
    // Before the stores go: a timer left running would keep renewing a session
    // the user just ended, and would 401 forever once the cookie is gone.
    cancelAccessRefresh();
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
    const result = await authApi.register(payload);
    await startSession(result?.accessExpiresAt);
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
