import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { PaginatedMovies } from './tmdb.types';
import { TmdbService } from './tmdb.service';

@ApiTags('tmdb')
@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdbService: TmdbService) {}

  @Get('popular')
  @ApiQuery({ name: 'page', required: false })
  fetchPopular(@Query() dto: PaginationQueryDto): Promise<PaginatedMovies> {
    return this.tmdbService.fetchPopular(dto.page);
  }

  @Get('search')
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'page', required: false })
  searchMovies(@Query() dto: SearchQueryDto): Promise<PaginatedMovies> {
    return this.tmdbService.searchMovies(dto.query, dto.page);
  }
}
