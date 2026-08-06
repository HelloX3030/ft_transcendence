import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FriendsModule } from './friends/friends.module';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { TmdbModule } from './tmdb/tmdb.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAccessGuard } from './auth/guard';
import { NotifyModule } from './notify/notify.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { FilesModule } from './files/files.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLERS } from './throttle.config';
import { SESSION_TTL_DEFAULT_SECONDS } from './auth/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        APP_ORIGINS: Joi.string().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().required(),
        MFA_KEY: Joi.string().length(64).hex().required(),
        TMDB_API_KEY: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        // Optional on purpose. `.required()` would mean a checkout without
        // Google credentials fails to boot — every developer, CI, and any
        // evaluator who clones the repo. Absent, the strategy is not registered
        // and GET /auth/google answers 503; see google.strategy.ts.
        GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
        GOOGLE_CALLBACK_URL: Joi.string().allow('').optional(),
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        MAIL_FROM: Joi.string().required(),
        PORT: Joi.number().default(3000),
        // Session timeouts. Optional, and defaulted to the production values, so
        // an existing checkout behaves identically — they exist so a tester can
        // shrink a 15-day idle timeout to a minute and actually watch it expire.
        // auth.service.ts carries the same defaults because it reads them at
        // module scope, which runs before this schema is applied.
        ACCESS_TTL_SECONDS: Joi.number().default(SESSION_TTL_DEFAULT_SECONDS.ACCESS_TTL_SECONDS),
        REFRESH_TTL_SECONDS: Joi.number().default(SESSION_TTL_DEFAULT_SECONDS.REFRESH_TTL_SECONDS),
        SESSION_ABSOLUTE_TTL_SECONDS: Joi.number().default(
          SESSION_TTL_DEFAULT_SECONDS.SESSION_ABSOLUTE_TTL_SECONDS,
        ),
        REFRESH_GRACE_SECONDS: Joi.number().default(
          SESSION_TTL_DEFAULT_SECONDS.REFRESH_GRACE_SECONDS,
        ),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    // ThrottlerModule is @Global(); registering it anywhere else would compete
    // with this one. Feature modules pick windows via @SkipThrottle instead.
    ThrottlerModule.forRoot(THROTTLERS),
    PrismaModule,
    RedisModule,
    MailModule,
    FriendsModule,
    MoviesModule,
    AuthModule,
    UsersModule,
    WatchlistsModule,
    TmdbModule,
    NotifyModule,
    NotificationsModule,
    ChatModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
  ],
})
export class AppModule {}
