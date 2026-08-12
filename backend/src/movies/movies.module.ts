import { Module } from '@nestjs/common';
import { RecommenderModule } from 'src/recommender/recommender.module';
import { TmdbModule } from 'src/tmdb/tmdb.module';
import { UtilsModule } from 'src/utils/utils.module';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';

@Module({
  imports: [UtilsModule, RecommenderModule, TmdbModule],
  controllers: [MoviesController],
  providers: [MoviesService],
})
export class MoviesModule {}
