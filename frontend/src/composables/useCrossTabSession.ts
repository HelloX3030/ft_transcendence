import { onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { onAuthBroadcast, onSessionEnded } from '@/lib/session-signals';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

/**
 * Keeps this tab in step with the one session the whole browser has.
 *
 * A composable rather than part of the auth store because the listener needs
 * `useRouter()`, and the router already imports the auth store, so the reverse
 * import would be a cycle. Used from App.vue, which is mounted for every route.
 */
export function useCrossTabSession() {
  const auth = useAuthStore();
  const user = useUserStore();
  const router = useRouter();

  function endSession(message: string) {
    // Also stops a burst of parallel 401s producing a stack of toasts.
    if (!auth.isLoggedIn) return;

    // No API call: the session is already deleted and the cookies are already
    // cleared. This is local teardown only.
    auth.clearSession();
    // Without this the tab silently jumps to a login screen and the user's
    // first thought is that the app crashed.
    toast.info(message);
    void router.replace('/login');
  }

  /**
   * Someone signed in elsewhere in this browser, and the cookies they were given
   * are this tab's cookies too: its next request is answered for the new user
   * while it still renders the old one, and its socket goes on delivering the old
   * one's events until the token behind it expires. A reload is the only
   * correction that cannot leave a store, a socket or a route behind.
   */
  function adoptSession(userId: number) {
    // A tab sitting on the login screen has nothing stale to correct, and
    // reloading it would throw away half-typed credentials. It picks the new
    // session up from the route guard on its next navigation.
    if (!auth.isLoggedIn) return;
    // The same account signing in again, a second device, an expired session
    // renewed, replaces the cookies but not who this tab is about.
    if (user.state?.id === userId) return;

    window.location.reload();
  }

  const stopBroadcast = onAuthBroadcast((message) => {
    if (message.type === 'logout') {
      endSession('You were signed out in another tab.');
      return;
    }
    adoptSession(message.userId);
  });
  const stopLocal = onSessionEnded(() =>
    endSession('Your session has ended. Please sign in again.'),
  );

  onUnmounted(() => {
    stopBroadcast();
    stopLocal();
  });
}
