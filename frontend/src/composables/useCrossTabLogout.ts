import { onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { onLogoutBroadcast, onSessionEnded } from '@/lib/session-signals';
import { useAuthStore } from '@/stores/auth';

/**
 * Moves this tab to the login screen when the session ended somewhere else.
 *
 * A composable rather than part of the auth store because the listener needs
 * `useRouter()`, and the router already imports the auth store — the reverse
 * import would be a cycle. Used from App.vue, which is mounted for every route.
 */
export function useCrossTabLogout() {
  const auth = useAuthStore();
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

  const stopBroadcast = onLogoutBroadcast(() => endSession('You were signed out in another tab.'));
  const stopLocal = onSessionEnded(() =>
    endSession('Your session has ended. Please sign in again.'),
  );

  onUnmounted(() => {
    stopBroadcast();
    stopLocal();
  });
}
