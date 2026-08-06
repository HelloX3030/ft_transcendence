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

describe('session signals — cross-tab logout', () => {
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
    expect(channel().posted).toEqual(['logout']);
  });

  it('runs the handler when another tab logs out', async () => {
    const { onLogoutBroadcast } = await loadModule();
    const handler = vi.fn();
    onLogoutBroadcast(handler);

    channel().deliver('logout');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores an unrelated message on the channel', async () => {
    const { onLogoutBroadcast } = await loadModule();
    const handler = vi.fn();
    onLogoutBroadcast(handler);

    channel().deliver('something-else');

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops delivering after the returned cleanup runs', async () => {
    const { onLogoutBroadcast } = await loadModule();
    const handler = vi.fn();
    const stop = onLogoutBroadcast(handler);

    stop();
    channel().deliver('logout');

    expect(handler).not.toHaveBeenCalled();
  });

  // Safari below 15.4, and the node environment these tests run in.
  it('degrades quietly when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const { broadcastLogout, onLogoutBroadcast } = await loadModule();
    const handler = vi.fn();

    expect(() => broadcastLogout()).not.toThrow();
    expect(() => onLogoutBroadcast(handler)()).not.toThrow();
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
