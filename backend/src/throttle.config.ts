import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * ThrottlerOptions allows ttl/limit to be resolved per request. Every window
 * here is a fixed number, and saying so lets callers do arithmetic on them.
 */
type FixedWindow = ThrottlerOptions & { ttl: number; limit: number };

/**
 * Every named throttler in the app, registered once in AppModule.
 *
 * ThrottlerModule is @Global(), so calling forRoot() in more than one feature
 * module registers competing global providers. Defining the windows here and
 * registering them in one place keeps that from happening.
 *
 * A guard enforces *all* named throttlers on the routes it covers, so a
 * controller has to @SkipThrottle the ones that are not meant for it.
 */

/** Absorbs normal bursts — opening a movie detail fires several requests at once. */
export const THROTTLE_BURST: FixedWindow = { name: 'burst', ttl: 10_000, limit: 30 };

/** Stops one account, or a runaway frontend loop, eating the shared TMDB budget. */
export const THROTTLE_SUSTAINED: FixedWindow = { name: 'sustained', ttl: 60_000, limit: 120 };

/**
 * Login and register — the unauthenticated endpoints where a password or a
 * 6-digit TOTP can be guessed.
 *
 * Tracked per IP, so the limit has to leave room for the many real users who
 * share one address behind CGNAT or an office NAT; 20/min does, while still
 * putting a 6-digit TOTP roughly a month out of reach and a password far
 * further. The cookie-authenticated routes (refresh, me, logout) skip this
 * window — they are not guessable, and a shared IP would exhaust it on
 * ordinary traffic.
 */
export const AUTH_WINDOW_MS = 60_000;
export const AUTH_ATTEMPTS_PER_WINDOW = 20;

export const THROTTLE_AUTH: ThrottlerOptions = {
  name: 'auth',
  ttl: AUTH_WINDOW_MS,
  // Resolved per request so the e2e suite, which registers and logs in far more
  // often than any real client and all from one address, is not stopped on 429
  // instead of on whatever it was actually testing. Only this window is lifted:
  // the TMDB windows stay live, and their own e2e test asserts they still bite.
  // Jest sets NODE_ENV=test when it is not already set; nothing else here does.
  limit: () =>
    process.env.NODE_ENV === 'test' ? Number.MAX_SAFE_INTEGER : AUTH_ATTEMPTS_PER_WINDOW,
};

export const THROTTLERS = [THROTTLE_BURST, THROTTLE_SUSTAINED, THROTTLE_AUTH];

/** For @SkipThrottle on routes that are not credential endpoints. */
export const SKIP_AUTH_THROTTLE = { auth: true };

/** For @SkipThrottle on credential endpoints, which use the auth window only. */
export const SKIP_TMDB_THROTTLES = { burst: true, sustained: true };
