import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const getAll = vi.fn();
vi.mock('@/api/endpoints/friends', () => ({
  friendsApi: {
    getAll: () => getAll(),
    sendRequest: vi.fn(),
    acceptRequest: vi.fn(),
    delete: vi.fn(),
  },
}));
// Details are fetched per friend once a list exists; irrelevant here and noisy
// if left real.
vi.mock('@/api/endpoints/user', () => ({ userApi: { getById: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn() } }));

const { useFriendsStore } = await import('./friends');

describe('friends store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    getAll.mockResolvedValue([]);
  });

  /**
   * The store is built transitively by useAuthStore() on main.ts's first line,
   * before auth.init() has run, so a fetch here is an authenticated request
   * issued before anyone could know whether there is a session, and a
   * guaranteed 401 for every logged-out visitor.
   */
  it('makes no request when it is created', () => {
    useFriendsStore();

    expect(getAll).not.toHaveBeenCalled();
  });

  it('fetches once ensureLoaded is asked', async () => {
    const store = useFriendsStore();

    await store.ensureLoaded();

    expect(getAll).toHaveBeenCalledTimes(1);
    expect(store.isReady).toBe(true);
  });

  it('does not fetch a second time', async () => {
    const store = useFriendsStore();

    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(getAll).toHaveBeenCalledTimes(1);
  });

  it('refetches when explicitly asked', async () => {
    const store = useFriendsStore();

    await store.ensureLoaded();
    await store.refetchFriends();

    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it('captures a failure instead of reporting it as uncaught', async () => {
    const failure = new Error('nope');
    getAll.mockRejectedValue(failure);
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);

    const store = useFriendsStore();
    await store.ensureLoaded();

    expect(store.error).toBe(failure);
    // vueuse's default onError is globalThis.reportError, which announces a
    // handled failure as though it were an uncaught exception.
    expect(reportError).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
