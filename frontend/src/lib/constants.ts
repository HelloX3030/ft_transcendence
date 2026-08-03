export const APP_NAME = import.meta.env.VITE_APP_NAME;
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Whether to offer "Continue with Google". False unless the server was given
 * Google credentials: the endpoint answers 503 without them, and a button that
 * fails on click reads as a broken feature rather than an absent one.
 */
export const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_ENABLED === 'true';

/** Full-page navigation, never fetch — an XHR cannot follow the redirect to Google. */
export const GOOGLE_LOGIN_URL = `${BACKEND_URL}/v1/auth/google`;

/**
 * Where the app itself is served from. Frontend and backend share one origin
 * behind the reverse proxy, so socket.io connects here and routes to the backend
 * through its engine.io `path` rather than through a different host.
 *
 * Guarded because unit tests run in a `node` environment with no `window`, and a
 * module-level throw here would take down every test that transitively imports
 * a store.
 */
export const FRONTEND_ORIGIN = typeof window === 'undefined' ? '' : window.location.origin;

// ISO 3166-1 region whose watch providers we surface (TMDB returns all regions).
export const DEFAULT_REGION = 'DE';
