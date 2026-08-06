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
import type { apiResponse } from '@cinemates/shared';
import { BACKEND_URL } from '@/lib/constants';

/** Every backend route is versioned; callers pass the path below that prefix. */
export const API_BASE = BACKEND_URL + '/v1';

let refreshPromise: Promise<void> | null = null;

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
