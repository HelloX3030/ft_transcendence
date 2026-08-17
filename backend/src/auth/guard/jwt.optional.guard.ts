import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches the user when there is a valid session, and lets the request through
 * when there is not.
 *
 * For the one endpoint whose job is to *answer* whether a session exists.
 * `@Public()` alone would not do: it skips the global guard entirely, so the
 * token is never validated and `req.user` is undefined even for a signed-in
 * caller. The default `handleRequest` does the opposite and throws a 401, which
 * turns "no, nobody is signed in" — a true and expected answer — into an error
 * the browser draws in red on every logged-out page load.
 */
@Injectable()
export class JwtOptionalGuard extends AuthGuard('jwt-access') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | null {
    return user ?? null;
  }
}
