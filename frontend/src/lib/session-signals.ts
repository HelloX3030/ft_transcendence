/**
 * How a tab learns that the session it renders is no longer the browser's. Kept
 * free of imports so the auth store and the API client can both reach it without
 * a cycle. Cross-tab goes over a BroadcastChannel; a tab that was not open at the
 * logout, or whose session expired server-side, learns it from a terminal 401.
 */

/** What one tab tells the others about the session they necessarily share. */
export type AuthBroadcast = { type: 'logout' } | { type: 'login'; userId: number };

const CHANNEL_NAME = 'auth';
const SESSION_ENDED = 'auth:session-ended';

/** Undefined in Safari below 15.4, and in the `node` environment the unit tests
 *  run in. Absent, this degrades to a tab that only notices on reload. */
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

/** BroadcastChannel does not deliver to the context that posted, so the acting
 *  tab needs no guard against hearing itself. */
function post(message: AuthBroadcast): void {
  getChannel()?.postMessage(message);
}

export function broadcastLogout(): void {
  post({ type: 'logout' });
}

/**
 * A login ends the previous session as surely as a logout does, since the cookies
 * are overwritten for the whole browser, but nothing 401s, so the other tabs
 * render the previous user while their requests are answered for the new one. The
 * id separates a different account signing in from the same one signing in again.
 */
export function broadcastLogin(userId: number): void {
  post({ type: 'login', userId });
}

export function onAuthBroadcast(handler: (message: AuthBroadcast) => void): () => void {
  const target = getChannel();
  if (target === null) return () => {};

  const listener = (event: MessageEvent) => {
    if (isAuthBroadcast(event.data)) handler(event.data);
  };
  target.addEventListener('message', listener);
  return () => target.removeEventListener('message', listener);
}

/** The channel is shared by origin, not owned, and a tab left over from an older
 *  deploy may post a shape this cannot read. */
function isAuthBroadcast(data: unknown): data is AuthBroadcast {
  if (typeof data !== 'object' || data === null) return false;

  const message = data as Record<string, unknown>;
  if (message.type === 'logout') return true;
  return message.type === 'login' && typeof message.userId === 'number';
}

/**
 * A 401 whose refresh also failed: the refresh token is gone, not merely the
 * access token. A first 401 that refreshes cleanly is the routine access-token
 * expiry and must never reach here.
 */
export function notifySessionEnded(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSION_ENDED));
}

export function onSessionEnded(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_ENDED, handler);
  return () => window.removeEventListener(SESSION_ENDED, handler);
}
