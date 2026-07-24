import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { PeopleQueryDto } from './dto/people-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { TmdbThrottlerGuard } from './tmdb-throttler.guard';
import { TmdbService } from './tmdb.service';

@ApiTags('tmdb')
@ApiTooManyRequestsResponse({ description: 'Per-user request limit for the TMDB proxy exceeded' })
// Every route here proxies to TMDB, whose rate limit is shared by all users, so
// they are throttled per account (see TmdbModule for the windows).
@UseGuards(TmdbThrottlerGuard)
@Controller('tmdb')
export class TmdbController {
  constructor(private readonly tmdbService: TmdbService) {}

  @Get('discover')
  discoverMovies(@Query() dto: DiscoverQueryDto) {
    return this.tmdbService.discoverMovies(dto);
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

  @Get('movies/:movieId')
  getMovieDetail(@Param('movieId', ParseIntPipe) movieId: number) {
    return this.tmdbService.getMovieDetail(movieId);
  }

  @Get('movies/:movieId/providers')
  getWatchProviders(@Param('movieId', ParseIntPipe) movieId: number) {
    return this.tmdbService.getWatchProviders(movieId);
  }
}
