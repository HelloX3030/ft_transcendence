import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PeopleQueryDto } from './dto/people-query.dto';
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

  @Get('genres')
  getGenres() {
    return this.tmdbService.getGenres();
  }

  @Get('people')
  getPeople(@Query() dto: PeopleQueryDto) {
    return this.tmdbService.getPeople(dto.ids);
  }

  @Get('movies/:movieId/providers')
  getWatchProviders(@Param('movieId', ParseIntPipe) movieId: number) {
    return this.tmdbService.getWatchProviders(movieId);
  }
}
