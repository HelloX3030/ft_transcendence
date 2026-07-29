import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessPayload } from 'src/types';

/**
 * Throttles per authenticated user rather than per IP. Every /tmdb route sits
 * behind JwtAccessGuard, and IP tracking would lump everyone behind one NAT or
 * proxy into a single bucket — while letting one account spread its load across
 * addresses. Falls back to the IP if there is somehow no user on the request.
 */
@Injectable()
export class TmdbThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const user = req.user as JwtAccessPayload | undefined;
    return Promise.resolve(user ? `user:${user.sub}` : `ip:${req.ip ?? 'unknown'}`);
  }
}
