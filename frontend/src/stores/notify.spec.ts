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
  // socket.io returns the socket itself, so `.timeout(n).emit(...)` chains. The
  // real one also changes the callback's shape, which the tests below rely on.
  timeout: vi.fn(() => socket),
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

describe('notify store — sending a chat message', () => {
  /** The acknowledgement callback the store handed to `emit`. */
  function ackCallback(): (timeout: Error | null, ack?: unknown) => void {
    const [, , callback] = socket.emit.mock.calls[0] as [string, unknown, Handler];
    return callback;
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    handlers.clear();
    vi.clearAllMocks();
  });

  it('resolves with the acknowledgement the server sent', async () => {
    const message = {
      id: 1,
      peerUserId: 2,
      senderUserId: 1,
      body: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const pending = useNotifyStore().sendChatMsg(2, 'hello', 'c-1');

    ackCallback()(null, { ok: true, message });

    await expect(pending).resolves.toEqual({ ok: true, message });
  });

  it('resolves with a failure rather than hanging when no acknowledgement arrives', async () => {
    const pending = useNotifyStore().sendChatMsg(2, 'hello', 'c-1');

    // What socket.io passes on a timeout, and on a disconnect with the send
    // still in flight. Before the timeout was in place this promise simply never
    // settled, and the message stayed optimistically rendered for good.
    ackCallback()(new Error('operation has timed out'));

    await expect(pending).resolves.toEqual({
      ok: false,
      error: 'The message could not be sent. Please try again.',
    });
  });

  it('treats an unrecognisable acknowledgement as a failure', async () => {
    const pending = useNotifyStore().sendChatMsg(2, 'hello', 'c-1');

    ackCallback()(null, { ok: true });

    await expect(pending).resolves.toEqual({
      ok: false,
      error: 'The server did not acknowledge the message.',
    });
  });
});
