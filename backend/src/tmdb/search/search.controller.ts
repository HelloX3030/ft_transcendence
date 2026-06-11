import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { TmdbMovie } from '../tmdb.types';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('tmdb')
@Controller('tmdb/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'page', required: false })
  searchMovies(@Query() dto: SearchQueryDto): Promise<TmdbMovie[]> {
    return this.searchService.searchMovies(dto.query, dto.page);
  }
}
