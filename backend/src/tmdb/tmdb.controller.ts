import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { PaginatedMovies } from '@trailertinder/shared';
import { TmdbService } from './tmdb.service';

@ApiTags('tmdb')
@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdbService: TmdbService) {}

  @Get('popular')
  fetchPopular(@Query() dto: PaginationQueryDto): Promise<PaginatedMovies> {
    return this.tmdbService.fetchPopular(dto.page, dto.filtered);
  }

  @Get('search')
  searchMovies(@Query() dto: SearchQueryDto): Promise<PaginatedMovies> {
    return this.tmdbService.searchMovies(dto.query, dto.page, dto.filtered);
  }
}
