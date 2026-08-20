import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { GoogleAuthException } from './auth.service';
import { requestOrigin } from 'src/config/origins';

/**
 * Turns a failed Google login into a redirect rather than a JSON error: the
 * browser reaches the callback by navigation, so there is no client waiting to
 * read a body. It is a filter rather than a try/catch in the handler because
 * `state` is checked in the guard, which runs before any handler code.
 */
@Catch(GoogleAuthException)
export class GoogleAuthExceptionFilter implements ExceptionFilter {
  catch(exception: GoogleAuthException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<ExpressResponse>();
    // Mid-flow, so the user lands back on the host they started from.
    const base = `${requestOrigin(http.getRequest<ExpressRequest>())}/auth/callback`;
    // Only the mapped code travels: an upstream error string would land in the
    // URL bar, browser history and every proxy log on the way.
    res.redirect(`${base}?error=${exception.code}`);
  }
}
