import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

type Handler = (...args: unknown[]) => void;

const handlers = new Map<string, Handler[]>();

const socket = {
  on: vi.fn((event: string, handler: Handler) => {
    const existing = handlers.get(event) ?? [];
    existing.push(handler);
    handlers.set(event, existing);
  }),
  off: vi.fn((event: string) => handlers.delete(event)),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(() => handlers.clear()),
};

/** Drives the store the way socket.io would, through its registered handlers. */
function fire(event: string, payload?: unknown) {
  for (const handler of handlers.get(event) ?? []) handler(payload);
}

vi.mock('socket.io-client', () => ({ io: () => socket }));
vi.mock('vue-sonner', () => ({ toast: { info: vi.fn() } }));
vi.mock('@/api/http', () => ({ refreshSession: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));
vi.mock('./chat', () => ({
  useChatStore: () => ({ hydrate: vi.fn(), ingestMessage: vi.fn(), $reset: vi.fn() }),
}));
vi.mock('./friends', () => ({ useFriendsStore: () => ({ refetchFriends: vi.fn() }) }));
vi.mock('./notifications', () => ({
  useNotificationsStore: () => ({ load: vi.fn(), ingest: vi.fn(), $reset: vi.fn() }),
}));
vi.mock('./watchlists', () => ({ useWatchlistsStore: () => ({ invalidate: vi.fn() }) }));

const { useNotifyStore } = await import('./notify');

describe('notify store — connection status', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    handlers.clear();
    vi.clearAllMocks();
  });

  it('starts idle, so a page that never connects shows nothing', () => {
    expect(useNotifyStore().connectionStatus).toBe('idle');
  });

  it('goes connecting on init and online on connect', () => {
    const store = useNotifyStore();

    store.init();
    expect(store.connectionStatus).toBe('connecting');

    fire('connect');
    expect(store.connectionStatus).toBe('online');
  });

  it('goes back to connecting when an established socket drops', () => {
    const store = useNotifyStore();
    store.init();
    fire('connect');

    fire('disconnect', 'transport close');

    expect(store.connectionStatus).toBe('connecting');
  });

  it('stays connecting while socket.io retries, and only then reports offline', () => {
    const store = useNotifyStore();
    store.init();

    for (let attempt = 1; attempt < 5; attempt++) {
      fire('connect_error', new Error('handshake failed'));
      expect(store.connectionStatus).toBe('connecting');
    }

    fire('connect_error', new Error('handshake failed'));
    expect(store.connectionStatus).toBe('offline');
  });

  it('resets the failure counter on a successful connect', () => {
    const store = useNotifyStore();
    store.init();
    for (let attempt = 0; attempt < 5; attempt++) fire('connect_error', new Error('nope'));
    expect(store.connectionStatus).toBe('offline');

    fire('connect');
    expect(store.connectionStatus).toBe('online');

    // Without the reset this single failure would land back on `offline`.
    fire('connect_error', new Error('nope'));
    expect(store.connectionStatus).toBe('connecting');
  });

  it('returns to idle on $reset, so logging out clears the indicator', () => {
    const store = useNotifyStore();
    store.init();
    fire('connect');

    store.$reset();

    expect(store.connectionStatus).toBe('idle');
  });
});
