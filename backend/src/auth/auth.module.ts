import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategy/';
import { JwtModule } from '@nestjs/jwt';
import { GoogleStrategy, isGoogleConfigured, JwtRefreshStrategy } from './strategy';
import { GoogleCallbackGuard, GoogleGuard, JwtAccessGuard, JwtRefreshGuard } from './guard';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthThrottlerGuard } from './auth-throttler.guard';

@Module({
  imports: [JwtModule.register({}), ScheduleModule.forRoot()],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAccessGuard,
    JwtRefreshGuard,
    GoogleGuard,
    GoogleCallbackGuard,
    AuthThrottlerGuard,
    // Registered only when credentials exist: passport-google-oauth20 throws
    // from its constructor on a missing clientID, so an unconditional provider
    // would stop a credential-less checkout from booting. Absent, the two routes
    // answer 503 and the frontend hides the button.
    ...(isGoogleConfigured() ? [GoogleStrategy] : []),
  ],
  exports: [JwtModule],
})
export class AuthModule {}
