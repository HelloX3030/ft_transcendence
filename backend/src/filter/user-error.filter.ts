import { Catch, HttpException, UseFilters } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Answers a 4xx the user caused with their own input (wrong password, taken
 * username, invalid TOTP) with HTTP 200, keeping the usual error body with
 * `success: false` and the real `statusCode`.
 *
 * Chrome logs every 4xx/5xx response as a console error, where no handler can
 * reach it, and the subject allows no console errors. The frontend client turns
 * such a body back into the same ApiError a real 4xx would produce.
 *
 * 401 keeps its status: the client's refresh-and-retry depends on it.
 */
@Catch(HttpException)
class UserErrorFilter extends HttpExceptionFilter {
  protected override responseStatus(status: number): number {
    return status >= 400 && status < 500 && status !== 401 ? 200 : status;
  }
}

/** Route decorator: see UserErrorFilter. Only for routes a user's input can fail. */
export const ExpectedUserErrors = () => UseFilters(UserErrorFilter);
