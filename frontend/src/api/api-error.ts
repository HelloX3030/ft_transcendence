/**
 * A backend call that came back with a non-2xx status.
 *
 * Callers need to tell a 409 from a 403 from "the request never reached the
 * server", and a plain `Error` carries none of that. Everything `backendClient`
 * rejects with is an `ApiError` except transport failures (offline, DNS, CORS),
 * which stay as whatever `fetch` threw — so `err instanceof ApiError` is the
 * check for "the backend answered, and it said no".
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
