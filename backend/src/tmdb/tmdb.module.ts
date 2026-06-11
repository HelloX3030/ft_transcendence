import { Module } from '@nestjs/common';
import { TmdbClient } from './tmdb.client';
import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';

@Module({
  controllers: [TmdbController],
  providers: [TmdbClient, TmdbService],
})
export class TmdbModule {}
