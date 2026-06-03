import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TmdbMovie } from '../tmdb.types';
import { PopularService } from './popular.service';

@ApiTags('tmdb')
@Controller('tmdb/popular')
export class PopularController {
  constructor(private readonly popularService: PopularService) {}

  @Get()
  fetchPopular(): Promise<TmdbMovie[]> {
    return this.popularService.fetchPopular();
  }
}
