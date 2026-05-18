import { Body, Controller, Post, Version } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    console.log('register request');
    console.log({
      dto: dto,
    });
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    console.log('login request');
    console.log({
      dto: dto,
    });
    return this.authService.login(dto);
  }
}
