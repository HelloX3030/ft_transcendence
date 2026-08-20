import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthBroadcast } from '@/lib/session-signals';

const reload = vi.fn();
const replace = vi.fn();
const clearSession = vi.fn();
const toastInfo = vi.fn();

const auth = { isLoggedIn: true, clearSession };
/** Who this tab believes it is, as the user store would report it. */
let ownUser: { id: number } | null = { id: 7 };
/** The listener the composable registered, so a message can be delivered to it. */
let deliver: (message: AuthBroadcast) => void = () => {};

// Called outside a component instance here; the cleanup it registers is not
// what these tests are about.
vi.mock('vue', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue')>()),
  onUnmounted: vi.fn(),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }));
vi.mock('vue-sonner', () => ({ toast: { info: toastInfo } }));
vi.mock('@/lib/session-signals', () => ({
  onAuthBroadcast: (handler: (message: AuthBroadcast) => void) => {
    deliver = handler;
    return () => {};
  },
  onSessionEnded: () => () => {},
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }));
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    get state() {
      return ownUser;
    },
  }),
}));

const { useCrossTabSession } = await import('./useCrossTabSession');

describe('useCrossTabSession: another tab signed in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { reload } });
    auth.isLoggedIn = true;
    ownUser = { id: 7 };
    useCrossTabSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The cookies are shared, so this tab is already that account: it would go on
  // rendering user 7 while writing as user 8.
  it('reloads when the browser now belongs to someone else', () => {
    deliver({ type: 'login', userId: 8 });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stays put when the same account signed in again', () => {
    deliver({ type: 'login', userId: 7 });

    expect(reload).not.toHaveBeenCalled();
  });

  // A tab on the login screen has nothing stale to correct, and reloading it
  // would throw away half-typed credentials.
  it('stays put when this tab is not signed in', () => {
    auth.isLoggedIn = false;

    deliver({ type: 'login', userId: 8 });

    expect(reload).not.toHaveBeenCalled();
  });

  it('still moves to the login screen when another tab signs out', () => {
    deliver({ type: 'logout' });

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
    expect(reload).not.toHaveBeenCalled();
  });
});
