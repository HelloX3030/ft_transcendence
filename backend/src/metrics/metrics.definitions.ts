import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Every metric this process exposes, defined once at module scope.
 *
 * Module scope rather than inside a provider on purpose: a metric may only be
 * registered once per registry, and Nest builds a fresh DI container for every
 * `Test.createTestingModule`, so a constructor-registered metric throws
 * "already registered" the second time a testing module is built. File scope is
 * evaluated once per process and is immune to that.
 *
 * The registry is our own rather than prom-client's global default, so nothing
 * a dependency happens to register leaks into our scrape output.
 */
export const registry = new Registry();

// Stamped onto every series, which is what lets one Prometheus job hold the
// backend and the recommender without their `http_*` metrics colliding.
registry.setDefaultLabels({ service: 'backend' });

/** Latency buckets in seconds: sub-millisecond cache hits up to a 5s TMDB timeout. */
const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

let defaultMetricsStarted = false;

/**
 * Registers process- and Node-level collectors: CPU, resident memory, open file
 * descriptors, heap, GC pauses and event-loop lag. Called from MetricsService's
 * lifecycle hook rather than at import time so that merely importing this file —
 * which every instrumented unit test does — starts no observers.
 */
export function startDefaultMetrics(): void {
  if (defaultMetricsStarted) return;
  defaultMetricsStarted = true;
  collectDefaultMetrics({ register: registry });
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The one metric that answers all three RED questions: rate, errors and
 * duration. `route` is the Express route *template* (`/v1/movies/:id`), never
 * the concrete URL — a path parameter in a label would mint a new time series
 * per movie id and exhaust the scrape.
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests handled by a controller, by route template.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently being handled.',
  labelNames: ['method'] as const,
  registers: [registry],
});

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The endpoint answers every failure with one generic 403 so it cannot be used
 * as an account-existence oracle. The metric is not bound by that: it is read by
 * operators, not callers, and telling an unknown address from a wrong password
 * is the difference between a credential-stuffing run and one confused user.
 */
export const authLoginAttempts = new Counter({
  name: 'auth_login_attempts_total',
  help: 'Password login attempts by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const authMfaVerifications = new Counter({
  name: 'auth_mfa_verifications_total',
  help: 'Second-factor (TOTP) verification attempts by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const authRegistrations = new Counter({
  name: 'auth_registrations_total',
  help: 'Account registration attempts by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

/**
 * `stale_key` is the interesting series. Refresh tokens rotate on every use, so
 * a key that is neither current nor inside the grace window means the same token
 * was presented twice — a replay, or a token that leaked. It is currently only a
 * log line; counting it makes it graphable and alertable.
 */
export const authTokenRefreshes = new Counter({
  name: 'auth_token_refreshes_total',
  help: 'Refresh-token exchanges by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const authPasswordResets = new Counter({
  name: 'auth_password_resets_total',
  help: 'Password-reset flow events by stage.',
  labelNames: ['stage'] as const,
  registers: [registry],
});

export const authGoogleLogins = new Counter({
  name: 'auth_google_logins_total',
  help: 'Google OAuth sign-in attempts by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const authLogouts = new Counter({
  name: 'auth_logouts_total',
  help: 'Sessions ended by an explicit logout.',
  registers: [registry],
});

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `namespace` is the first colon-separated segment of the key (`tmdb`,
 * `pwreset`) and nothing more. The rest of a key carries the query string or a
 * user id, so anything deeper would be unbounded cardinality.
 */
export const cacheOperations = new Counter({
  name: 'cache_operations_total',
  help: 'Redis reads by key namespace and result.',
  labelNames: ['namespace', 'result'] as const,
  registers: [registry],
});

export const cacheWrites = new Counter({
  name: 'cache_writes_total',
  help: 'Redis writes by key namespace and result.',
  labelNames: ['namespace', 'result'] as const,
  registers: [registry],
});

/* -------------------------------------------------------------------------- */
/* Upstreams                                                                  */
/* -------------------------------------------------------------------------- */

export const tmdbRequests = new Counter({
  name: 'tmdb_requests_total',
  help: 'Outbound requests to TMDB by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const tmdbRequestDuration = new Histogram({
  name: 'tmdb_request_duration_seconds',
  help: 'Duration of outbound TMDB requests, excluding time spent waiting for budget.',
  labelNames: ['outcome'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

/**
 * Raised when the self-imposed TMDB rate budget is exhausted and a caller is
 * turned away with a 503 rather than queued. A non-zero rate here is the
 * limiter working; a sustained one means the ceiling is too low for the traffic.
 */
export const tmdbBudgetRejections = new Counter({
  name: 'tmdb_budget_rejections_total',
  help: 'Requests rejected because the outbound TMDB rate budget was exhausted.',
  registers: [registry],
});

export const recommenderRequests = new Counter({
  name: 'recommender_requests_total',
  help: 'Calls to the recommendation service by endpoint and outcome.',
  labelNames: ['endpoint', 'outcome'] as const,
  registers: [registry],
});

export const recommenderRequestDuration = new Histogram({
  name: 'recommender_request_duration_seconds',
  help: 'Duration of calls to the recommendation service.',
  labelNames: ['endpoint'] as const,
  buckets: LATENCY_BUCKETS,
  registers: [registry],
});

export const mailSends = new Counter({
  name: 'mail_send_total',
  help: 'Transactional mails handed to SMTP by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const storageUploads = new Counter({
  name: 'storage_uploads_total',
  help: 'Object-storage uploads by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const storageUploadBytes = new Counter({
  name: 'storage_upload_bytes_total',
  help: 'Bytes written to object storage.',
  registers: [registry],
});

/* -------------------------------------------------------------------------- */
/* WebSocket presence                                                         */
/* -------------------------------------------------------------------------- */

export const wsConnections = new Counter({
  name: 'ws_connections_total',
  help: 'Notify-namespace handshakes by outcome.',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

export const wsDisconnections = new Counter({
  name: 'ws_disconnections_total',
  help: 'Notify-namespace sockets closed.',
  registers: [registry],
});

export const wsConnectionsActive = new Gauge({
  name: 'ws_connections_active',
  help: 'Authenticated notify sockets currently open. One user may hold several.',
  registers: [registry],
});

export const wsUsersOnline = new Gauge({
  name: 'ws_users_online',
  help: 'Distinct users with at least one open notify socket.',
  registers: [registry],
});

export const wsExpiredSocketsDropped = new Counter({
  name: 'ws_expired_sockets_dropped_total',
  help: 'Sockets disconnected by the sweep because their access token ran out.',
  registers: [registry],
});

export const wsEventsSent = new Counter({
  name: 'ws_events_sent_total',
  help: 'Server-pushed notify events by kind.',
  labelNames: ['kind'] as const,
  registers: [registry],
});

/* -------------------------------------------------------------------------- */
/* Business totals                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Gauges rather than counters: they are read back from the database as absolute
 * totals, and rows can be deleted, so they go down as well as up. Refreshed on a
 * timer — see BusinessMetricsCollector for why not on scrape.
 */
export const appUsers = new Gauge({
  name: 'app_users_total',
  help: 'Registered user accounts.',
  registers: [registry],
});

export const appRatings = new Gauge({
  name: 'app_ratings_total',
  help: 'Movie reactions recorded.',
  registers: [registry],
});

export const appMovies = new Gauge({
  name: 'app_movies_total',
  help: 'Movies known locally.',
  registers: [registry],
});

export const appWatchlists = new Gauge({
  name: 'app_watchlists_total',
  help: 'Watchlists created.',
  registers: [registry],
});

export const appMessages = new Gauge({
  name: 'app_messages_total',
  help: 'Chat messages stored.',
  registers: [registry],
});

export const appSessionsActive = new Gauge({
  name: 'app_sessions_active',
  help: 'Session rows that have not yet expired.',
  registers: [registry],
});

export const appFriendships = new Gauge({
  name: 'app_friendships_total',
  help: 'Friendship rows by status.',
  labelNames: ['status'] as const,
  registers: [registry],
});
