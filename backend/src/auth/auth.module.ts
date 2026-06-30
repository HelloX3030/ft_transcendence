import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategy/';
import { JwtModule } from '@nestjs/jwt';
import { JwtRefreshStrategy } from './strategy';
import { JwtAccessGuard, JwtRefreshGuard } from './guard';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [JwtModule.register({}), ScheduleModule.forRoot()],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy, JwtAccessGuard, JwtRefreshGuard],
  exports: [JwtModule],
})
export class AuthModule {}
