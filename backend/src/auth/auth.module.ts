import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategy/';
import { JwtModule } from '@nestjs/jwt';
import { JwtRefreshStrategy } from './strategy';
import { JwtAccessGuard, JwtRefreshGuard } from './guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy, JwtAccessGuard, JwtRefreshGuard],
})
export class AuthModule {}
