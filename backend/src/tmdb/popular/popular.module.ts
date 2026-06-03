import { Module } from '@nestjs/common';
import { TmdbClient } from '../tmdb.client';
import { PopularController } from './popular.controller';
import { PopularService } from './popular.service';

@Module({
  controllers: [PopularController],
  providers: [TmdbClient, PopularService],
})
export class PopularModule {}
