import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request as ExpressRequest } from 'express';

const BEARER = 'Bearer ';

/**
 * Guards the scrape endpoint with the shared secret in METRICS_TOKEN.
 *
 * The backend publishes no port and Caddy refuses `/api/metrics`, so this is the
 * third layer: it is what stops anything else already on the Docker network —
 * frontend, mailpit, pgadmin, minio all sit on it — from reading the metrics by
 * name. That matters because a scrape is a map of the system: every route,
 * traffic volumes, user totals, and the login-failure rate an attacker would
 * watch to see their guessing start working.
 */
@Injectable()
export class MetricsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ExpressRequest>();
    const header = request.headers.authorization ?? '';
    const presented = header.startsWith(BEARER) ? header.slice(BEARER.length) : '';

    if (!matchesToken(presented, process.env.METRICS_TOKEN ?? '')) {
      // 404 rather than 401, so a wrong token and a request that never got past
      // the proxy are indistinguishable, and neither confirms the route exists.
      throw new NotFoundException();
    }
    return true;
  }
}

/**
 * timingSafeEqual throws when the two buffers differ in length, and the throw
 * itself would reveal the secret's length. Hashing both to a fixed 32 bytes
 * first makes the comparison constant-time for every input, including an absent
 * header. An unset METRICS_TOKEN hashes to the same digest as an empty
 * presented token, so the empty string is rejected explicitly.
 */
function matchesToken(presented: string, expected: string): boolean {
  if (expected.length === 0 || presented.length === 0) return false;

  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
