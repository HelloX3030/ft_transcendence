import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  Response,
  HttpCode,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import { AuthService } from './auth.service';
import { JwtRefreshGuard, Public } from './guard';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { JwtRefreshPayload } from 'src/types';
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

  // Cookie-authenticated, so there is nothing here to guess; a shared IP would
  // burn the login window on ordinary traffic.
  @SkipThrottle(SKIP_AUTH_THROTTLE)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns the authenticated user payload' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@Request() req: ExpressRequest) {
    return req.user;
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
  @Get('logout')
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'User logout successful' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token signature' })
  logout(@Request() req: ExpressRequest, @Response({ passthrough: true }) res: ExpressResponse) {
    if (req.user === undefined) throw new BadRequestException();
    return this.authService.logout(req.user as JwtRefreshPayload, res);
  }
}
