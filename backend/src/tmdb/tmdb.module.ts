import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TmdbThrottlerGuard } from './tmdb-throttler.guard';
import { TmdbClient } from './tmdb.client';
import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';

// Per-user caps on the TMDB proxy. Two windows: a short one that absorbs normal
// bursts (opening a movie detail fires several requests at once) and a longer
// one that stops a single account — or a runaway frontend loop — from consuming
// the shared TMDB budget on its own. Registered here rather than globally so it
// guards only this module's routes.
const THROTTLE_BURST = { name: 'burst', ttl: 10_000, limit: 30 };
const THROTTLE_SUSTAINED = { name: 'sustained', ttl: 60_000, limit: 120 };

@Module({
  imports: [ThrottlerModule.forRoot([THROTTLE_BURST, THROTTLE_SUSTAINED])],
  controllers: [TmdbController],
  providers: [TmdbClient, TmdbService, TmdbThrottlerGuard],
})
export class TmdbModule {}
