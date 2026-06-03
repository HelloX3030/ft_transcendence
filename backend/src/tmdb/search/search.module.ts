import { Module } from '@nestjs/common';
import { TmdbClient } from '../tmdb.client';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [TmdbClient, SearchService],
})
export class SearchModule {}
