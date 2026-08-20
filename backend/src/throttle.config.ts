import type { ThrottlerOptions } from '@nestjs/throttler';

/** ThrottlerOptions allows ttl/limit per request; every window here is fixed. */
type FixedWindow = ThrottlerOptions & { ttl: number; limit: number };

/**
 * Every named throttler in the app, registered once in AppModule: ThrottlerModule
 * is @Global(), so a forRoot() in a second feature module would register
 * competing providers. A guard enforces all named throttlers on the routes it
 * covers, so a controller has to @SkipThrottle the ones not meant for it.
 */

/** Absorbs normal bursts: opening a movie detail fires several requests at once. */
export const THROTTLE_BURST: FixedWindow = { name: 'burst', ttl: 10_000, limit: 30 };

/** Stops one account, or a runaway frontend loop, eating the shared TMDB budget. */
export const THROTTLE_SUSTAINED: FixedWindow = { name: 'sustained', ttl: 60_000, limit: 120 };

/**
 * Login and register, where a password or a 6-digit TOTP can be guessed. Tracked
 * per IP, so the limit leaves room for real users sharing one address behind
 * CGNAT; 20/min still puts a 6-digit TOTP about a month out of reach. The
 * cookie-authenticated routes skip this window.
 */
export const AUTH_WINDOW_MS = 60_000;
export const AUTH_ATTEMPTS_PER_WINDOW = 20;

export const THROTTLE_AUTH: ThrottlerOptions = {
  name: 'auth',
  ttl: AUTH_WINDOW_MS,
  // Resolved per request so the e2e suite, which logs in far more often than any
  // client and from one address, is not stopped on 429. Only this window is
  // lifted; the TMDB windows stay live and their own e2e test asserts it.
  limit: () =>
    process.env.NODE_ENV === 'test' ? Number.MAX_SAFE_INTEGER : AUTH_ATTEMPTS_PER_WINDOW,
};

export const THROTTLERS = [THROTTLE_BURST, THROTTLE_SUSTAINED, THROTTLE_AUTH];

/** For @SkipThrottle on routes that are not credential endpoints. */
export const SKIP_AUTH_THROTTLE = { auth: true };

/** For @SkipThrottle on credential endpoints, which use the auth window only. */
export const SKIP_TMDB_THROTTLES = { burst: true, sustained: true };
