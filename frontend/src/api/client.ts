import type { apiResponse } from '@trailertinder/shared';
import { BACKEND_URL } from '@/lib/constants';
import { ApiError } from './api-error';

/** Every backend route is versioned; callers pass the path below that prefix. */
const API_BASE = BACKEND_URL + '/v1';

let refreshPromise: Promise<void> | null = null;

/**
 * Pulls a displayable message out of a backend error body. Nest sends
 * `{ message: string }`, except ValidationPipe, which sends one string per
 * rejected field.
 */
function errorMessage(body: unknown, status: number): string {
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

export async function backendClient<T>(
  path: string,
  options?: RequestInit,
  retried = false,
): Promise<T> {
  const response = await fetch(API_BASE + path, {
    credentials: 'include',
    ...options,
  });

  if (response.status === 401 && !retried) {
    try {
      await refreshSession();
      return backendClient<T>(path, options, true);
    } catch {
      throw new ApiError(401, 'Not authenticated');
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(body, response.status), body);
  }

  // Read as text first: an empty body makes response.json() throw a SyntaxError
  // that surfaces to the caller as an opaque failure rather than as the 2xx it is.
  const text = await response.text();
  if (text === '') return undefined as T;

  const json: apiResponse<T> = JSON.parse(text);
  // `in` throws a TypeError on null and on primitives, both of which are valid
  // JSON bodies, so the envelope check has to be narrowed to objects first.
  // TODO: remove the fallback once every backend endpoint returns { data: ... }
  if (typeof json === 'object' && json !== null && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}
