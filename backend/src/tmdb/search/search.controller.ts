import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('tmdb')
@Controller('tmdb/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiQuery({ name: 'query', required: true })
  searchMovies(@Query('query') query: string): Promise<unknown> {
    return this.searchService.searchMovies(query);
  }
}
