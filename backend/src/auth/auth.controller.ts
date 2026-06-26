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
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Creates a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Credentials taken' })
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
  async login(
    @Request() req: ExpressRequest,
    @Body() dto: LoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    return this.authService.login(req, dto, res);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns the authenticated user payload' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@Request() req: ExpressRequest) {
    return req.user;
  }

  @Public()
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
