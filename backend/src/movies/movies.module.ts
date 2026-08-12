import { Module } from '@nestjs/common';
import { UtilsModule } from 'src/utils/utils.module';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';

@Module({
  imports: [UtilsModule],
  controllers: [MoviesController],
  providers: [MoviesService],
})
export class MoviesModule {}
