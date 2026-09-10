import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { FriendsModule } from './friends/friends.module';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { TmdbModule } from './tmdb/tmdb.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAccessGuard } from './auth/guard';
import { NotifyModule } from './notify/notify.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { FilesModule } from './files/files.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { MetricsModule } from './metrics/metrics.module';
import { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor';
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
        // Shared secret Prometheus presents to scrape GET /metrics. Required,
        // not optional-with-a-default: an absent value would leave the endpoint
        // open to everything else on the Docker network, and a default would be
        // the same published secret on every checkout.
        METRICS_TOKEN: Joi.string().min(32).required(),
        APP_ORIGINS: Joi.string().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().required(),
        MFA_KEY: Joi.string().length(64).hex().required(),
        TMDB_API_KEY: Joi.string().required(),
        // The ceiling we hold ourselves to on outbound TMDB traffic, and the
        // window it is measured over. Required rather than defaulted: compose
        // interpolates an unset ${VAR} to an empty string, which Joi.number()
        // rejects instead of falling back, so a default would fail confusingly.
        TMDB_RATE_LIMIT: Joi.number().integer().min(1).required(),
        TMDB_RATE_WINDOW_SECONDS: Joi.number().positive().required(),
        RECOMMENDER_URL: Joi.string().uri().required(),
        // How much of the derived onboarding profile is handed to the
        // recommendation service. min(0), not min(1): zero is the meaningful
        // value: it withholds a dimension whose Discover filter is currently
        // over-constrained, and the derivation still computes it either way.
        ONBOARDING_MAX_GENRES: Joi.number().integer().min(0).required(),
        ONBOARDING_MAX_ACTORS: Joi.number().integer().min(0).required(),
        ONBOARDING_MAX_DIRECTORS: Joi.number().integer().min(0).required(),
        REDIS_URL: Joi.string().required(),
        // Optional on purpose. `.required()` would mean a checkout without
        // Google credentials fails to boot, every developer, CI, and any
        // evaluator who clones the repo. Absent, the strategy is not registered
        // and GET /auth/google answers 503; see google.strategy.ts.
        GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
        GOOGLE_CALLBACK_URL: Joi.string().allow('').optional(),
        SMTP_HOST: Joi.string().required(),
        SMTP_PORT: Joi.number().required(),
        MAIL_FROM: Joi.string().required(),
        PORT: Joi.number().default(3000),
        // Session timeouts, defaulted to the production values so an existing
        // checkout behaves identically. auth.service.ts carries the same defaults
        // because it reads them at module scope, before this schema is applied.
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
    MetricsModule,
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
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
    // Global so a new controller is measured the day it is written, rather than
    // the day someone remembers to instrument it.
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
