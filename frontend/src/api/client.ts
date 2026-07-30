import { ApiError } from './api-error';
import { API_BASE, errorMessage, parseJson, refreshSession, unwrapEnvelope } from './http';

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
    const body = parseJson(await response.text());
    throw new ApiError(response.status, errorMessage(body, response.status), body);
  }

  // Read as text first, so `unwrapEnvelope` can tell an empty body apart from a
  // JSON one instead of failing on it.
  return unwrapEnvelope<T>(await response.text());
}
