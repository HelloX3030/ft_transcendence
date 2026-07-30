export const APP_NAME = import.meta.env.VITE_APP_NAME;
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

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
