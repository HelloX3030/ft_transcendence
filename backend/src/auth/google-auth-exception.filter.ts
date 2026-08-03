import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { GoogleAuthException } from './auth.service';

/**
 * Turns a failed Google login into a redirect rather than a JSON error.
 *
 * The browser reaches the callback by navigation, so there is no client waiting
 * to read a response body — an error page would be a dead end. This sends the
 * user back to the SPA with a code it maps to copy.
 *
 * A filter rather than a try/catch in the handler because `state` is checked in
 * the guard, which runs before any handler code.
 */
@Catch(GoogleAuthException)
export class GoogleAuthExceptionFilter implements ExceptionFilter {
  catch(exception: GoogleAuthException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<ExpressResponse>();
    const base = `${process.env.CORS_ORIGIN ?? ''}/auth/callback`;
    // Only the mapped code travels: an upstream error string would land in the
    // URL bar, browser history and every proxy log on the way.
    res.redirect(`${base}?error=${exception.code}`);
  }
}
