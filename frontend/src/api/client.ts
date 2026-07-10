import type { apiResponse } from '@trailertinder/shared';

//TODO: use env for url
export async function backendClient<T>(
  path: string,
  options?: RequestInit,
  // opts: { expectData?: boolean } = { expectData: true },
): Promise<T> {
  const response = await fetch('http://localhost:3000/v1' + path, {
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.log('frontend request:', path, options);
    throw new Error(error?.message ?? `Request failed: ${response.status}`);
  }

  // if (opts.expectData === false) {
  //   console.log('backendClient response:', response);
  //   return undefined as T; //TODO: find a better way to handle this, maybe use a different function for requests that don't expect data
  // }

  const json: apiResponse<T> = await response.json();
  if (json.data === undefined || json.data === null) {
    console.log('frontend request:', path, options);
    console.log('backendClient response:', json);
    // throw new Error('Response data is empty');
    return json; //TODO: wait for backend to fix response types
  }
  console.log('frontend request:', path, options);
  console.log('backendClient response:', json);

  return json.data;
}
