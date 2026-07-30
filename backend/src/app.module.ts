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
import { APP_GUARD } from '@nestjs/core';
import { JwtAccessGuard } from './auth/guard';
import { NotifyModule } from './notify/notify.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLERS } from './throttle.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        CORS_ORIGIN: Joi.string().required(),
        MINIO_ENDPOINT: Joi.string().required(),
        MINIO_PUBLIC_URL: Joi.string().required(),
        MINIO_ACCESS_KEY: Joi.string().required(),
        MINIO_SECRET_KEY: Joi.string().required(),
        MINIO_BUCKET: Joi.string().required(),
        APP_NAME: Joi.string().required(),
        MFA_KEY: Joi.string().length(64).hex().required(),
        TMDB_API_KEY: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        PORT: Joi.number().default(3000),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    // ThrottlerModule is @Global(); registering it anywhere else would compete
    // with this one. Feature modules pick windows via @SkipThrottle instead.
    ThrottlerModule.forRoot(THROTTLERS),
    PrismaModule,
    RedisModule,
    FriendsModule,
    MoviesModule,
    AuthModule,
    UsersModule,
    WatchlistsModule,
    TmdbModule,
    NotifyModule,
    NotificationsModule,
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
