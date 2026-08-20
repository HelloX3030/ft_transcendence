export { APP_NAME } from '@cinemates/shared';
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Whether to offer "Continue with Google". False unless the server was given
 * Google credentials, since the endpoint answers 503 without them.
 */
export const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_ENABLED === 'true';

/** Full-page navigation, never fetch: an XHR cannot follow the redirect to Google. */
export const GOOGLE_LOGIN_URL = `${BACKEND_URL}/v1/auth/google`;

/**
 * Where the app itself is served from. Frontend and backend share one origin
 * behind the reverse proxy, so socket.io connects here and reaches the backend
 * through its engine.io `path`. Guarded because unit tests run in a `node`
 * environment with no `window`.
 */
export const FRONTEND_ORIGIN = typeof window === 'undefined' ? '' : window.location.origin;

/**
 * ISO 3166-1 country whose streaming availability every user sees. One fixed
 * country, not a fallback: the audience for this build is in Germany. A user
 * elsewhere sees no providers rather than wrong ones, and both call sites hide
 * the section when the list is empty. Frontend-only; the server fetches
 * region-neutral (see `TmdbService.getWatchProviders`).
 */
export const WATCH_PROVIDER_REGION = 'DE';
