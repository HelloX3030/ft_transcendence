import type { apiResponse } from '@trailertinder/shared';

//TODO: use env for url
export async function backendClient<T>(path: string, options?: RequestInit): Promise<T | null> {
  const response = await fetch('http://localhost:3000/v1' + path, {
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? `Request failed: ${response.status}`);
  }

  const json: apiResponse<T> = await response.json();
  console.log('backendClient response:', json);
  return json.data ?? null;
}
