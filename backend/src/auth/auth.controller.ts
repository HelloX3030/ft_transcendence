import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  BadRequestException,
  Response,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import { AuthService } from './auth.service';
import { JwtRefreshGuard, Public } from './guard';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { JwtRefreshPayload } from 'src/types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  async handleAuth<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      } else {
        console.error(error);
        throw new InternalServerErrorException();
      }
    }
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Response({ passthrough: true }) res: ExpressResponse) {
    console.log('register request');

    return this.handleAuth(() => this.authService.register(dto, res));
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Response({ passthrough: true }) res: ExpressResponse) {
    console.log('login request');
    return this.handleAuth(() => this.authService.login(dto, res));
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    console.log('refresh request');
    if (req.user === undefined) throw new BadRequestException();
    return this.handleAuth(() => this.authService.refresh(req.user as JwtRefreshPayload, res));
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Get('logout')
  logout(@Request() req: ExpressRequest, @Response({ passthrough: true }) res: ExpressResponse) {
    console.log('logout request');
    if (req.user === undefined) throw new BadRequestException();
    return this.handleAuth(() => this.authService.logout(req.user as JwtRefreshPayload, res));
  }

  @Get('test')
  test() {
    return { message: 'test sucsessfuly' };
  }
}
