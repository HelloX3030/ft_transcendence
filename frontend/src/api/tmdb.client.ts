export async function fetchJson<T>(url: string): Promise<T> {
  //TODO: remove key
  const res = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + import.meta.env.VITE_TMDB_API_KEY,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
  return (await res.json()) as T;
}
