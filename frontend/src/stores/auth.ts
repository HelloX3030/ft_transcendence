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

  // The notify store is resolved where it is used, not here: resolving it in the
  // setup body would build the notify, chat and friends stores as soon as
  // anything called `useAuthStore()`, which main.ts does before init() has run.

  async function init() {
    try {
      const session = await authApi.session();
      isLoggedIn.value = session.authenticated;
      // A reload rebuilds the session from the cookie the browser still holds,
      // so the schedule has to be rebuilt with it, or expiry is discovered
      // through a 401 again.
      if (session.authenticated) scheduleAccessRefresh(session.accessExpiresAt);
    } catch {
      // A genuine network failure: the endpoint answers 200 either way, so
      // "nobody is signed in" does not arrive here. Stay logged out.
    }
  }

  // Like register(), errors bubble: useLogin turns them into errorMessage.
  async function login(payload: LoginRequest): Promise<LoginResponse | null> {
    const result = await authApi.login(payload);
    if (!result?.mfaRequired) await startSession(result?.accessExpiresAt);
    return result;
  }

  /**
   * Shared tail of every path that ends up authenticated. `accessExpiresAt` comes
   * from whichever response issued the cookie; the Google path has none, since it
   * arrives by redirect and confirms the session through `init()`.
   */
  async function startSession(accessExpiresAt?: number) {
    isLoggedIn.value = true;
    scheduleAccessRefresh(accessExpiresAt);
    const userStore = useUserStore();
    await userStore.refetchUser();
    useNotifyStore().init();
    // Only the paths that establish a session run through here, so the other tabs
    // are told exactly once, by the tab that changed what the browser holds.
    // Nothing to announce without an id: the refetch is what failed.
    const userId = userStore.state?.id;
    if (userId !== undefined) broadcastLogin(userId);
  }

  // Second step of an MFA login. Takes the challenge token from login(), not the
  // password, which is deliberately not kept around. On the Google path the token
  // is omitted and the backend reads it from a cookie.
  async function verifyMfa(payload: MfaVerifyRequest) {
    const result = await authApi.verifyMfa(payload);
    await startSession(result?.accessExpiresAt);
  }

  /**
   * Tail of an OAuth login. The session cookies were set by the backend during the
   * redirect, so this only confirms they work. Returns false when they do not,
   * which is how the callback view tells a dropped cookie from a sign-in.
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
      // The server-side session may already be gone, swept or ended from another
      // tab. Local state must go either way.
    } finally {
      clearSession();
      // Fires even when the request failed: the cookies are cleared client-side
      // either way, so the other tabs are just as dead. Not in clearSession(),
      // which the password-reset path calls without a session to end.
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
