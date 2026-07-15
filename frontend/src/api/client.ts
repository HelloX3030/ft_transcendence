import type { apiResponse } from '@trailertinder/shared';

//TODO: use env for url
export async function backendClient<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('http://localhost:3000/v1' + path, {
    credentials: 'include',
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.log('frontend request:', path, options, 'error:', error);
    throw new Error(error?.message ?? `Request failed: ${response.status}`);
  }

  const json: apiResponse<T> = await response.json();
  console.log('frontend request:', path, options, 'response:', response.status, 'data:', json);
  return ('data' in json ? json.data : json) as T; // TODO: remove fallback once all backend endpoints consistently return { data: ... } wrapper
}
