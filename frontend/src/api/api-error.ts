/**
 * A backend call that came back with a non-2xx status. Transport failures
 * (offline, DNS, CORS) stay as whatever `fetch` threw, so `err instanceof
 * ApiError` means the backend answered and said no.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The parsed error body, when the response had one. */
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
