/**
 * The ways a tab finds out the session it is rendering is no longer the one the
 * browser holds. Kept in a module with no imports of its own so the auth store
 * and the API client can both reach them without an import cycle.
 *
 * Cross-tab: cookies are per-browser, not per-tab, so one tab ending or
 * replacing the session does it for all of them. Without a message the other
 * tabs keep rendering a session that is gone, and only a reload puts them right.
 * A BroadcastChannel is ephemeral and same-origin by construction, which is
 * exactly the lifetime this needs — nothing is persisted.
 *
 * Same-tab: a BroadcastChannel cannot reach a tab that was not open at the
 * moment of the logout, or one whose session expired server-side rather than
 * being ended by a click. Those tabs learn it from a terminal 401 instead.
 */

/** What one tab tells the others about the session they necessarily share. */
export type AuthBroadcast = { type: 'logout' } | { type: 'login'; userId: number };

const CHANNEL_NAME = 'auth';
const SESSION_ENDED = 'auth:session-ended';

/** Undefined in Safari below 15.4, and in the `node` environment the unit tests
 *  run in — where constructing one at module scope would take down every spec
 *  that transitively imports a store. Absent, this degrades to a tab that only
 *  notices on reload, which is today's behaviour. */
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
 * A login ends the previous session as surely as a logout does — the cookies are
 * overwritten for the whole browser — but it leaves the other tabs believing in
 * it, which is the more dangerous half. Nothing 401s, so nothing detects it:
 * those tabs render the previous user while every request they make is answered
 * for the new one.
 *
 * The id is what separates "someone else is signed in here now" from the same
 * account signing in again, which changes nothing a tab is showing.
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

/** The channel is shared by origin, not owned — anything else on it is not ours,
 *  and a tab left over from an older deploy may post a shape this cannot read. */
function isAuthBroadcast(data: unknown): data is AuthBroadcast {
  if (typeof data !== 'object' || data === null) return false;

  const message = data as Record<string, unknown>;
  if (message.type === 'logout') return true;
  return message.type === 'login' && typeof message.userId === 'number';
}

/**
 * A 401 whose refresh *also* failed: the refresh token is gone, not merely the
 * access token. A first 401 that refreshes cleanly is the routine 15-minute
 * access-token expiry and must never reach here — logging the user out on that
 * would be far worse than the bug this fixes.
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
