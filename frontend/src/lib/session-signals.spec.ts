import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Minimal BroadcastChannel stand-in. Node has neither it nor `window`, and the
 * point of these tests is which listeners fire for which message — not the
 * browser's delivery machinery.
 */
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];

  posted: unknown[] = [];
  private listeners: ((event: MessageEvent) => void)[] = [];

  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((entry) => entry !== listener);
  }

  /** Delivers as another tab would — the real API never echoes to the sender. */
  deliver(data: unknown) {
    for (const listener of this.listeners) listener({ data } as MessageEvent);
  }
}

/** The module caches its channel, so each case needs a fresh copy of it. */
async function loadModule() {
  vi.resetModules();
  return import('./session-signals');
}

/** The one channel the module under test opened. */
function channel(): FakeBroadcastChannel {
  const [only] = FakeBroadcastChannel.instances;
  if (only === undefined) throw new Error('no channel was opened');
  return only;
}

describe('session signals — cross-tab session changes', () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts exactly one message per logout', async () => {
    const { broadcastLogout } = await loadModule();

    broadcastLogout();

    expect(FakeBroadcastChannel.instances).toHaveLength(1);
    expect(channel().posted).toEqual([{ type: 'logout' }]);
  });

  it('names the account a login belongs to, which is the whole point of it', async () => {
    const { broadcastLogin } = await loadModule();

    broadcastLogin(7);

    expect(channel().posted).toEqual([{ type: 'login', userId: 7 }]);
  });

  it('runs the handler when another tab logs out', async () => {
    const { onAuthBroadcast } = await loadModule();
    const handler = vi.fn();
    onAuthBroadcast(handler);

    channel().deliver({ type: 'logout' });

    expect(handler).toHaveBeenCalledWith({ type: 'logout' });
  });

  it('runs the handler when another tab logs in', async () => {
    const { onAuthBroadcast } = await loadModule();
    const handler = vi.fn();
    onAuthBroadcast(handler);

    channel().deliver({ type: 'login', userId: 7 });

    expect(handler).toHaveBeenCalledWith({ type: 'login', userId: 7 });
  });

  it('ignores an unrelated message on the channel', async () => {
    const { onAuthBroadcast } = await loadModule();
    const handler = vi.fn();
    onAuthBroadcast(handler);

    channel().deliver('something-else');

    expect(handler).not.toHaveBeenCalled();
  });

  // A tab left over from an older deploy still posts to the same channel.
  it('ignores a login that names no account', async () => {
    const { onAuthBroadcast } = await loadModule();
    const handler = vi.fn();
    onAuthBroadcast(handler);

    channel().deliver({ type: 'login' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering after the returned cleanup runs', async () => {
    const { onAuthBroadcast } = await loadModule();
    const handler = vi.fn();
    const stop = onAuthBroadcast(handler);

    stop();
    channel().deliver({ type: 'logout' });

    expect(handler).not.toHaveBeenCalled();
  });

  // Safari below 15.4, and the node environment these tests run in.
  it('degrades quietly when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const { broadcastLogin, broadcastLogout, onAuthBroadcast } = await loadModule();
    const handler = vi.fn();

    expect(() => broadcastLogout()).not.toThrow();
    expect(() => broadcastLogin(7)).not.toThrow();
    expect(() => onAuthBroadcast(handler)()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('session signals — terminal 401', () => {
  const listeners = new Map<string, EventListener[]>();
  const fakeWindow = {
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    addEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((entry) => entry !== listener),
      );
    },
  };

  beforeEach(() => {
    listeners.clear();
    vi.stubGlobal('window', fakeWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies subscribers when the session ends', async () => {
    const { notifySessionEnded, onSessionEnded } = await loadModule();
    const handler = vi.fn();
    onSessionEnded(handler);

    notifySessionEnded();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after the returned cleanup runs', async () => {
    const { notifySessionEnded, onSessionEnded } = await loadModule();
    const handler = vi.fn();
    const stop = onSessionEnded(handler);

    stop();
    notifySessionEnded();

    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing without a window', async () => {
    vi.stubGlobal('window', undefined);
    const { notifySessionEnded, onSessionEnded } = await loadModule();
    const handler = vi.fn();

    expect(() => onSessionEnded(handler)()).not.toThrow();
    expect(() => notifySessionEnded()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
