import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseFilters,
  Request,
  Response,
  HttpCode,
} from '@nestjs/common';
import { GoogleAuthExceptionFilter } from './google-auth-exception.filter';
import { ForgotPasswordDto, LoginDto, MfaVerifyDto, RegisterDto, ResetPasswordDto } from './dto';
import { AuthService } from './auth.service';
import {
  GoogleCallbackGuard,
  GoogleGuard,
  JwtOptionalGuard,
  JwtRefreshGuard,
  Public,
} from './guard';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { apiResponse, SessionResponse } from '@cinemates/shared';
import { successResponse } from 'src/utils';
import { GoogleProfile, JwtAccessPayload, JwtRefreshPayload } from 'src/types';
import { ApiOperation, ApiResponse, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthThrottlerGuard } from './auth-throttler.guard';
import { SKIP_AUTH_THROTTLE, SKIP_TMDB_THROTTLES } from 'src/throttle.config';

// Credential endpoints: unauthenticated, and login checks both a password and a
// 6-digit TOTP, so they get a tight per-IP window. The TMDB windows are far too
// loose to be useful here and would only mask the auth one.
@SkipThrottle(SKIP_TMDB_THROTTLES)
@UseGuards(AuthThrottlerGuard)
@ApiTooManyRequestsResponse({ description: 'Too many authentication attempts from this IP' })
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Creates a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Credentials taken' })
  @ApiResponse({ status: 429, description: 'Too many attempts from this IP' })
  async register(
    @Request() req: ExpressRequest,
    @Body() dto: RegisterDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.register(req, dto, res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login with optional TOTP' })
  @ApiResponse({ status: 200, description: 'User login successful' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Invalid credentials or TOTP required' })
  @ApiResponse({ status: 429, description: 'Too many attempts from this IP' })
  async login(
    @Request() req: ExpressRequest,
    @Body() dto: LoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.login(req, dto, res);
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Second step of an MFA login: challenge token + TOTP' })
  @ApiResponse({ status: 200, description: 'User login successful' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Invalid or expired challenge token, or invalid TOTP' })
  @ApiResponse({ status: 429, description: 'Too many attempts from this IP' })
  async verifyMfa(
    @Request() req: ExpressRequest,
    @Body() dto: MfaVerifyDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.verifyMfa(req, dto, res);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(200)
  @ApiOperation({ summary: 'Requests a password reset link by email' })
  // One response, always. A different answer for a known and an unknown address
  // would turn this into an account-existence oracle.
  @ApiResponse({ status: 200, description: 'Generic acknowledgement, whatever the address was' })
  @ApiResponse({ status: 400, description: 'Malformed email address' })
  @ApiResponse({ status: 429, description: 'Too many attempts from this IP' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Completes a password reset and revokes every session' })
  @ApiResponse({ status: 200, description: 'Password updated' })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired or already-used link, weak password, or invalid TOTP',
  })
  @ApiResponse({
    status: 403,
    description: 'The account has TOTP enabled and no `otp` was supplied (`mfaRequired: true`)',
  })
  @ApiResponse({ status: 429, description: 'Too many attempts from this IP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // Both legs can fail with a GoogleAuthException, which has to leave as a
  // redirect rather than JSON: the browser arrives here by navigation.
  @UseFilters(GoogleAuthExceptionFilter)
  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Starts the Google OAuth 2.0 redirect flow' })
  @ApiResponse({ status: 302, description: "Redirect to Google's consent screen" })
  @ApiResponse({ status: 503, description: 'Google sign-in is not configured on this server' })
  @UseGuards(GoogleGuard)
  googleAuth() {
    // The guard redirects to Google, so this body is never reached.
  }

  @UseFilters(GoogleAuthExceptionFilter)
  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 2.0 callback that establishes the session' })
  @ApiResponse({ status: 302, description: 'Redirect to the frontend /auth/callback route' })
  @ApiResponse({ status: 503, description: 'Google sign-in is not configured on this server' })
  // No `passthrough`: this handler owns the response because every outcome,
  // success or failure, is a redirect rather than a JSON body.
  @UseGuards(GoogleCallbackGuard)
  async googleCallback(@Request() req: ExpressRequest, @Response() res: ExpressResponse) {
    if (req.user === undefined) throw new BadRequestException();
    return this.authService.googleCallback(req, req.user as GoogleProfile, res);
  }

  // Cookie-authenticated, so there is nothing here to guess; a shared IP would
  // burn the login window on ordinary traffic.
  @SkipThrottle(SKIP_AUTH_THROTTLE)
  // Public so the global guard steps aside, then optional-auth so the token is
  // still validated and attached when there is one. This endpoint is a
  // question, and "nobody is signed in" is one of its two correct answers, not
  // an error. The profile stays behind GET /users/me, which is still guarded.
  @Public()
  @UseGuards(JwtOptionalGuard)
  @Get('me')
  @ApiOperation({ summary: 'Reports whether the caller has a session' })
  @ApiResponse({
    status: 200,
    description: 'Answers { authenticated: false } or the token payload',
  })
  me(@Request() req: ExpressRequest): apiResponse<SessionResponse> {
    const user = req.user as JwtAccessPayload | null | undefined;
    if (!user) return successResponse<SessionResponse>({ authenticated: false });
    // `exp` is in seconds; the client compares it against Date.now(). A token
    // without one cannot expire, so nothing is scheduled for it.
    return successResponse<SessionResponse>({
      authenticated: true,
      sub: user.sub,
      email: user.email,
      accessExpiresAt: (user.exp ?? 0) * 1000,
    });
  }

  @Public()
  @SkipThrottle(SKIP_AUTH_THROTTLE)
  @UseGuards(JwtRefreshGuard)
  @Get('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'JWT token refresh successful' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token signature' })
  @ApiResponse({ status: 403, description: 'Invalid refresh token session' })
  async refresh(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    if (req.user === undefined) throw new BadRequestException();
    return this.authService.refresh(req.user as JwtRefreshPayload, res);
  }

  @Public()
  @SkipThrottle(SKIP_AUTH_THROTTLE)
  @UseGuards(JwtRefreshGuard)
  // POST, not GET: ending a session is a state change, so it must not be
  // reachable by prefetch or a cross-site navigation.
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'User logout successful' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token signature' })
  logout(@Request() req: ExpressRequest, @Response({ passthrough: true }) res: ExpressResponse) {
    if (req.user === undefined) throw new BadRequestException();
    return this.authService.logout(req.user as JwtRefreshPayload, res);
  }
}
