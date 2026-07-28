import type { apiResponse } from '@trailertinder/shared';

let refreshPromise: Promise<void> | null = null;

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
      throw new Error('Not authenticated');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.log('frontend request:', path, options, 'error:', error);
    throw new Error(error?.message ?? `Request failed: ${response.status}`);
  }

  const json: apiResponse<T> = await response.json();
  // console.log('frontend request:', path, options, 'response:', response.status, 'data:', json);
  return ('data' in json ? json.data : json) as T; // TODO: remove fallback once all backend endpoints consistently return { data: ... } wrapper
}
