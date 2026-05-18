import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto';
import { AuthService } from './auth.service';
import { Public } from './guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    console.log('register request');
    console.log({
      dto: dto,
    });
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    console.log('login request');
    console.log({
      dto: dto,
    });
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh() {
    console.log('refresh request');
  }

  // guard example
  // @UseGuards(JwtGuard)
  // @Post('refresh')
  // refresh(@Request() req) {
  //   console.log(req.user);
  // }
}
