import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const logout = vi.fn();
const broadcastLogout = vi.fn();
const resetAllStores = vi.fn();
const notifyStop = vi.fn();

vi.mock('@/api/endpoints/auth', () => ({ authApi: { logout: () => logout() } }));
vi.mock('@/lib/session-signals', () => ({ broadcastLogout: () => broadcastLogout() }));
vi.mock('./plugins/resetPlugin', () => ({ resetAllStores: () => resetAllStores() }));
vi.mock('./notify', () => ({ useNotifyStore: () => ({ init: vi.fn(), stop: notifyStop }) }));
vi.mock('./user', () => ({ useUserStore: () => ({ refetchUser: vi.fn() }) }));

const { useAuthStore } = await import('./auth');

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
