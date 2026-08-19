export { APP_NAME } from '@cinemates/shared';
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

/**
 * ISO 3166-1 country whose streaming availability every user sees.
 *
 * Not a fallback and not user-configurable — deliberately one fixed country. The
 * audience for this build is in Germany, so DE is the availability they can check
 * against their own subscriptions. A user elsewhere sees no providers rather than
 * wrong ones; both call sites hide the section when the list is empty.
 *
 * Independent of the `en-GB` date formatting in `format.ts`: that pins how text is
 * written, this pins where the content is watched. TMDB models them as separate
 * parameters for the same reason — `de` alone would not say whether to mean DE, AT
 * or CH.
 *
 * Frontend-only on purpose; see the note on the server's region-neutral fetch in
 * `TmdbService.getWatchProviders`.
 */
export const WATCH_PROVIDER_REGION = 'DE';
