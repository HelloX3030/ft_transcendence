import type { Request as ExpressRequest } from 'express';

/**
 * Every origin the browser may reach this app at, in the order given.
 *
 * The backend sits on a private Docker network behind a proxy and cannot derive
 * any of this on its own, which is why the variable has to exist at all. Read at
 * module scope rather than through ConfigModule because the gateway decorator in
 * notify.gateway.ts is evaluated before Nest's DI container exists.
 */
export const APP_ORIGINS = (process.env.APP_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** The name this app calls itself in anything that outlives the request. */
export const CANONICAL_ORIGIN = APP_ORIGINS[0] ?? '';

/**
 * The origin *this* request arrived on, so a redirect returns the user to the
 * host they started from. Falls back to canonical unless the reconstructed
 * origin is one we accept; that allowlist check is what stops a forged Host
 * header from steering the redirect. `req.protocol` sees https because of
 * `trust proxy` in main.ts.
 */
export function requestOrigin(req: ExpressRequest): string {
  const host = req.get('host');
  const origin = host ? `${req.protocol}://${host}` : '';
  return APP_ORIGINS.includes(origin) ? origin : CANONICAL_ORIGIN;
}
