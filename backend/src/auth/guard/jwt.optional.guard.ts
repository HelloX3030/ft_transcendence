import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches the user when there is a valid session and lets the request through
 * when there is not, for the one endpoint whose job is to answer whether a
 * session exists. `@Public()` skips the global guard entirely, so `req.user`
 * would be undefined even for a signed-in caller, and the default `handleRequest`
 * throws a 401 for an answer that is true and expected.
 */
@Injectable()
export class JwtOptionalGuard extends AuthGuard('jwt-access') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | null {
    return user ?? null;
  }
}
