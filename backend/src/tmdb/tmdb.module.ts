import { Module } from '@nestjs/common';
import { TmdbThrottlerGuard } from './tmdb-throttler.guard';
import { TmdbClient } from './tmdb.client';
import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';

// Per-user caps on the TMDB proxy. The burst/sustained windows live in
// src/throttle.config.ts and are registered once in AppModule.
@Module({
  controllers: [TmdbController],
  providers: [TmdbClient, TmdbService, TmdbThrottlerGuard],
  // MoviesModule enriches recommended ids into playable feed cards.
  exports: [TmdbService],
})
export class TmdbModule {}
