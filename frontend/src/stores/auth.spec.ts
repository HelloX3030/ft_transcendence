import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const logout = vi.fn();
const login = vi.fn();
const session = vi.fn();
const broadcastLogout = vi.fn();
const broadcastLogin = vi.fn();
const resetAllStores = vi.fn();
const notifyStop = vi.fn();

/** Who `refetchUser` leaves the user store holding. */
let signedInUser: { id: number } | null = null;

vi.mock('@/api/endpoints/auth', () => ({
  authApi: {
    logout: () => logout(),
    login: (payload: unknown) => login(payload),
    session: () => session(),
  },
}));
vi.mock('@/lib/session-signals', () => ({
  broadcastLogout: () => broadcastLogout(),
  broadcastLogin: (userId: number) => broadcastLogin(userId),
}));
vi.mock('./plugins/resetPlugin', () => ({ resetAllStores: () => resetAllStores() }));
vi.mock('./notify', () => ({ useNotifyStore: () => ({ init: vi.fn(), stop: notifyStop }) }));
vi.mock('./user', () => ({
  useUserStore: () => ({
    refetchUser: vi.fn(),
    get state() {
      return signedInUser;
    },
  }),
}));

const { useAuthStore } = await import('./auth');

describe('auth store — init', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('reads the answer rather than catching it', async () => {
    // GET /auth/me answers 200 either way: "nobody is signed in" is a true
    // answer to the question, and a 401 for it printed a console error on
    // every logged-out page load that no catch could unprint.
    session.mockResolvedValue({ authenticated: false });
    const store = useAuthStore();

    await store.init();

    expect(store.isLoggedIn).toBe(false);
  });

  it('is signed in when the session says so', async () => {
    session.mockResolvedValue({ authenticated: true, sub: 1, email: 'a@b.de' });
    const store = useAuthStore();

    await store.init();

    expect(store.isLoggedIn).toBe(true);
  });

  it('stays logged out when the request itself fails', async () => {
    session.mockRejectedValue(new Error('offline'));
    const store = useAuthStore();

    await expect(store.init()).resolves.toBeUndefined();
    expect(store.isLoggedIn).toBe(false);
  });
});

describe('auth store — logout', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('tears down locally and tells the other tabs once', async () => {
    logout.mockResolvedValue(undefined);

    await useAuthStore().logout();

    expect(resetAllStores).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledTimes(1);
  });

  // The cookies are cleared client-side either way, so the other tabs are just
  // as dead whether or not the request reached the server.
  it('still tells the other tabs when the request fails', async () => {
    logout.mockRejectedValue(new Error('backend is down'));

    await expect(useAuthStore().logout()).resolves.toBeUndefined();

    expect(resetAllStores).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).toHaveBeenCalledTimes(1);
  });

  // A password reset ends the session server-side too, but from a context that
  // never had one here — broadcasting from it would be a message about nothing.
  it('does not broadcast from clearSession alone', () => {
    useAuthStore().clearSession();

    expect(resetAllStores).toHaveBeenCalledTimes(1);
    expect(broadcastLogout).not.toHaveBeenCalled();
  });
});

describe('auth store — starting a session', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    signedInUser = { id: 7 };
    login.mockResolvedValue({ mfaRequired: false });
  });

  // The other tabs share these cookies, so they are this account now too. The id
  // is what lets them tell that apart from the same user signing in again.
  it('tells the other tabs which account signed in', async () => {
    await useAuthStore().login({ email: 'a@example.com', password: 'secret' });

    expect(broadcastLogin).toHaveBeenCalledWith(7);
  });

  it('says nothing when the user could not be identified', async () => {
    signedInUser = null;

    await useAuthStore().login({ email: 'a@example.com', password: 'secret' });

    expect(broadcastLogin).not.toHaveBeenCalled();
  });

  // The session is not established until the second factor is in, and the tab
  // that owns the challenge is still the only one that knows about it.
  it('says nothing while a login is still waiting on MFA', async () => {
    login.mockResolvedValue({ mfaRequired: true });

    await useAuthStore().login({ email: 'a@example.com', password: 'secret' });

    expect(broadcastLogin).not.toHaveBeenCalled();
  });
});
