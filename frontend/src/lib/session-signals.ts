/**
 * The two ways a tab finds out its session is over. Kept in a module with no
 * imports of its own so the auth store and the API client can both reach them
 * without an import cycle.
 *
 * Cross-tab: cookies are per-browser, not per-tab, so one tab logging out ends
 * the session for all of them. Without a message the other tabs keep rendering
 * an authenticated UI whose every request 401s, and only a reload puts them
 * right. A BroadcastChannel is ephemeral and same-origin by construction, which
 * is exactly the lifetime this needs — nothing is persisted.
 *
 * Same-tab: a BroadcastChannel cannot reach a tab that was not open at the
 * moment of the logout, or one whose session expired server-side rather than
 * being ended by a click. Those tabs learn it from a terminal 401 instead.
 */

const CHANNEL_NAME = 'auth';
const LOGOUT = 'logout';
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
export function broadcastLogout(): void {
  getChannel()?.postMessage(LOGOUT);
}

export function onLogoutBroadcast(handler: () => void): () => void {
  const target = getChannel();
  if (target === null) return () => {};

  const listener = (event: MessageEvent) => {
    if (event.data === LOGOUT) handler();
  };
  target.addEventListener('message', listener);
  return () => target.removeEventListener('message', listener);
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
