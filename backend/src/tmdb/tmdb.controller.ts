import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { TmdbService } from './tmdb.service';

@ApiTags('tmdb')
@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdbService: TmdbService) {}

  @Get('popular')
  fetchPopular(@Query() dto: PaginationQueryDto) {
    return this.tmdbService.fetchPopular(dto.page, dto.filtered);
  }

  @Get('search')
  searchMovies(@Query() dto: SearchQueryDto) {
    return this.tmdbService.searchMovies(dto.query, dto.page, dto.filtered);
  }
}
