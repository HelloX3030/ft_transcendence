/**
 * Transport primitives shared by every way we talk to the backend.
 *
 * `backendClient` (fetch) and `uploadWithProgress` (XMLHttpRequest) are two
 * transports with one contract: same base URL, same credentials, same
 * 401-refresh-retry, same error mapping, same response envelope. Those pieces
 * live here rather than in either transport, because a divergent 401 path in the
 * upload client would mean uploads mysteriously failing on expired sessions
 * while everything else quietly recovered.
 */
import type { AccessTokenExpiry, apiResponse } from '@cinemates/shared';
import { BACKEND_URL } from '@/lib/constants';

/** Every backend route is versioned; callers pass the path below that prefix. */
export const API_BASE = BACKEND_URL + '/v1';

let refreshPromise: Promise<void> | null = null;

/**
 * How much of the access token's life to spend before renewing it. The rest is
 * headroom for clock skew and a slow request.
 */
const REFRESH_AT_LIFETIME_FRACTION = 0.8;

/** Floor on the delay, so a token already near its end cannot spin. */
const MIN_REFRESH_DELAY_MS = 5_000;

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Pulls a displayable message out of a backend error body. Nest sends
 * `{ message: string }`, except ValidationPipe, which sends one string per
 * rejected field.
 */
export function errorMessage(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message !== '') return message;
  if (Array.isArray(message) && message.length > 0) return message.join(', ');
  return `Request failed: ${status}`;
}

/**
 * Renews the access cookie, coalescing concurrent callers onto one request.
 * Exported for the notify socket, whose handshake fails once the cookie
 * expires and which has no other way to recover.
 */
export function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = refreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshToken() {
  const response = await fetch(API_BASE + '/auth/refresh', {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Refresh failed');
  }
  // The renewed cookie has its own lifetime, so the schedule is set again from
  // the answer rather than assumed to repeat.
  //
  // Never allowed to fail the refresh: the cookie is already set by the time the
  // body is read, so a response we cannot parse costs the next schedule — which
  // the reactive 401 path still covers — not the session.
  try {
    const body = unwrapEnvelope<AccessTokenExpiry>(await response.text());
    scheduleAccessRefresh(body?.accessExpiresAt);
  } catch {
    scheduleAccessRefresh(undefined);
  }
}

/**
 * Renews the access cookie shortly before it lapses.
 *
 * The reactive path in `backendClient` — 401, refresh, retry — recovers, but it
 * cannot prevent the 401 itself, and Chrome prints every 401 to the console from
 * its own network stack where no handler, catch or logger can reach it. The only
 * way to remove that line is for the request never to fail, which means renewing
 * ahead of time. The reactive path stays as the fallback for what a timer cannot
 * cover: a suspended laptop, a clock that jumped, a tab throttled in the
 * background.
 *
 * Called with the expiry every session-establishing response reports. Passing
 * `undefined` only cancels — a client that was told nothing schedules nothing.
 */
export function scheduleAccessRefresh(accessExpiresAt: number | undefined) {
  cancelAccessRefresh();
  if (accessExpiresAt === undefined || accessExpiresAt <= 0) return;

  const lifetimeLeft = accessExpiresAt - Date.now();
  const delay = Math.max(lifetimeLeft * REFRESH_AT_LIFETIME_FRACTION, MIN_REFRESH_DELAY_MS);

  refreshTimer = setTimeout(() => {
    // Reschedules itself: a successful refreshToken() feeds the new expiry back
    // into this function.
    void refreshSession().catch(() => {
      // The session is over. The 401 handling in `backendClient` owns the
      // redirect; retrying on a timer would only add a failure per period.
    });
  }, delay);
}

/** Stops the schedule. Called on logout, and on every reschedule. */
export function cancelAccessRefresh() {
  if (refreshTimer !== undefined) clearTimeout(refreshTimer);
  refreshTimer = undefined;
}

/** Parses a JSON body without throwing, for error responses that may be empty. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Unwraps the `{ data }` envelope from a 2xx body. */
export function unwrapEnvelope<T>(text: string): T {
  // An empty body makes JSON.parse throw a SyntaxError that would surface to the
  // caller as an opaque failure rather than as the 2xx it is.
  if (text === '') return undefined as T;

  const json: apiResponse<T> = JSON.parse(text) as apiResponse<T>;
  // `in` throws a TypeError on null and on primitives, both of which are valid
  // JSON bodies, so the envelope check has to be narrowed to objects first.
  // TODO: remove the fallback once every backend endpoint returns { data: ... }
  if (typeof json === 'object' && json !== null && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}
