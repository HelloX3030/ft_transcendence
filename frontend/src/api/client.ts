import type { apiResponse } from '@trailertinder/shared';
import { ApiError } from './api-error';

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

async function refreshToken() {
  const response = await fetch('http://localhost:3000/v1/auth/refresh', {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Refresh failed');
  }
}

//TODO: use env for url
export async function backendClient<T>(
  path: string,
  options?: RequestInit,
  retried = false,
): Promise<T> {
  const response = await fetch('http://localhost:3000/v1' + path, {
    credentials: 'include',
    ...options,
  });

  if (response.status === 401 && !retried) {
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      await refreshPromise;
      return backendClient<T>(path, options, true);
    } catch {
      throw new ApiError(401, 'Not authenticated');
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, errorMessage(body, response.status), body);
  }

  const json: apiResponse<T> = await response.json();
  return ('data' in json ? json.data : json) as T; // TODO: remove fallback once all backend endpoints consistently return { data: ... } wrapper
}
