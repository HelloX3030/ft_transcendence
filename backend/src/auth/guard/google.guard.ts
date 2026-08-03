import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { AuthService } from '../auth.service';
import { isGoogleConfigured } from '../strategy/google.strategy';

/**
 * Answers 503 when the server has no Google credentials. Without them the
 * strategy is never registered, and passport's own "Unknown strategy" error
 * surfaces as an opaque 500.
 */
function assertConfigured(): void {
  if (!isGoogleConfigured()) {
    throw new ServiceUnavailableException('Google sign-in is not configured on this server');
  }
}

/**
 * First leg: mints the CSRF `state`, stores it in a cookie and hands it to
 * passport for the authorization URL.
 */
@Injectable()
export class GoogleGuard extends AuthGuard('google') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    assertConfigured();
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const res = context.switchToHttp().getResponse<ExpressResponse>();
    return { state: this.authService.issueGoogleState(res) };
  }
}

/**
 * Second leg: checks `state` **before** delegating to passport, so a forged
 * callback is rejected without ever exchanging its `code` at Google.
 */
@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    assertConfigured();
    const http = context.switchToHttp();
    this.authService.verifyGoogleState(
      http.getRequest<ExpressRequest>(),
      http.getResponse<ExpressResponse>(),
    );
    return super.canActivate(context);
  }
}
