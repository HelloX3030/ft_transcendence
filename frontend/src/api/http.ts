/**
 * Transport primitives shared by `backendClient` (fetch) and `uploadWithProgress`
 * (XMLHttpRequest): same base URL, credentials, 401-refresh-retry, error mapping
 * and response envelope.
 */
import type { AccessTokenExpiry, apiResponse } from '@cinemates/shared';
import { BACKEND_URL } from '@/lib/constants';
import { ApiError } from './api-error';

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
  // The renewed cookie has its own lifetime, so the schedule is set from the
  // answer. Never allowed to fail the refresh: the cookie is already set by the
  // time the body is read, so an unparseable response costs the next schedule,
  // which the reactive 401 path still covers.
  try {
    const body = unwrapEnvelope<AccessTokenExpiry>(await response.text());
    scheduleAccessRefresh(body?.accessExpiresAt);
  } catch {
    scheduleAccessRefresh(undefined);
  }
}

/**
 * Renews the access cookie shortly before it lapses. The reactive path in
 * `backendClient` (401, refresh, retry) recovers but cannot prevent the 401, and
 * Chrome prints every 401 from its own network stack, where no handler can reach
 * it. That path stays as the fallback for what a timer cannot cover: a suspended
 * laptop, a jumped clock, a throttled background tab. Passing `undefined` only
 * cancels the schedule.
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

/**
 * Whether a rejection is the browser abandoning a request rather than a failure.
 * Answered here once, so no catch has to tell an aborted upload or a fetch
 * cancelled by navigation apart from a real fault.
 */
export function isCancelledRequest(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Parses a JSON body without throwing, for error responses that may be empty. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Unwraps the `{ data }` envelope from a 2xx body, throwing for an error one. */
export function unwrapEnvelope<T>(text: string): T {
  // An empty body makes JSON.parse throw a SyntaxError that would surface to the
  // caller as an opaque failure rather than as the 2xx it is.
  if (text === '') return undefined as T;

  const json = JSON.parse(text) as apiResponse<T> & { statusCode?: unknown };
  // A user-input failure the backend answers with 200 so Chrome does not log it
  // (see backend UserErrorFilter). Thrown as the ApiError a real 4xx would be.
  if (json.success === false && typeof json.statusCode === 'number') {
    throw new ApiError(json.statusCode, errorMessage(json, json.statusCode), json);
  }
  return json.data as T;
}
