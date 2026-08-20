import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Throttles the credential endpoints by client IP.
 *
 * Unlike the TMDB guard there is no authenticated user to bucket by, which is
 * the whole point of these routes. Bucketing by the submitted email instead
 * would let an attacker sidestep the limit by varying it, and would hand anyone
 * a way to lock a known account out.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(`ip:${req.ip ?? 'unknown'}`);
  }
}
