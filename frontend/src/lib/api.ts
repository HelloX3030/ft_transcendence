import type { apiResponse } from '@trailertinder/shared';

// Fetches the backend's apiResponse<T> envelope and returns its data, throwing on
// HTTP errors or an unsuccessful/empty envelope (otherwise an error body would be
// parsed as the expected type and missing fields would crash the views).
// credentials:'same-origin' because the /v1/* routes are auth-guarded (cookie session).
export async function fetchData<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
  const body = (await res.json()) as apiResponse<T>;
  if (!body.success || body.data == null) {
    throw new Error(body.error ?? `Request to ${url} returned no data`);
  }
  return body.data;
}
