import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscoverQuery } from '@cinemates/shared';
import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import { IsNotAfter } from './is-not-after.validator';
import { PaginationQueryDto } from './pagination-query.dto';

// The sort options the UI offers, in TMDB's `<field>.<direction>` form.
// `release_date` is the UI's name for what TMDB calls `primary_release_date`;
// the service maps it before issuing the request.
export const DISCOVER_SORT_OPTIONS = [
  'popularity.asc',
  'popularity.desc',
  'revenue.asc',
  'revenue.desc',
  'vote_average.asc',
  'vote_average.desc',
  'release_date.asc',
  'release_date.desc',
];

// Optional discover filters layered on top of pagination and the quality toggle.
// All go straight into the TMDB /discover/movie request, so each is validated to
// a strict shape. `implements DiscoverQuery` binds the parameter names to the
// shared contract the frontend builds its URL from.
export class DiscoverQueryDto extends PaginationQueryDto implements DiscoverQuery {
  @ApiPropertyOptional({ description: 'Sort order', enum: DISCOVER_SORT_OPTIONS })
  @IsOptional()
  @IsIn(DISCOVER_SORT_OPTIONS)
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated TMDB genre ids (matched with AND)',
    example: '28,12',
  })
  @IsOptional()
  @Matches(/^\d+(,\d+)*$/, {
    message: 'withGenres must be a comma-separated list of genre ids',
  })
  withGenres?: string;

  // The two decorators do different jobs: the regex pins the date-only shape
  // (@IsISO8601 alone would also accept a full timestamp), while @IsISO8601
  // strict rejects dates that match the shape but aren't real days, 2026-99-99
  // and 2019-02-29 would otherwise reach TMDB, which silently returns nothing.
  @ApiPropertyOptional({ description: 'Earliest primary release date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'releaseDateGte must be in YYYY-MM-DD format' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'releaseDateGte is not a real date' },
  )
  @IsNotAfter('releaseDateLte', {
    message: 'releaseDateGte must not be after releaseDateLte',
  })
  releaseDateGte?: string;

  @ApiPropertyOptional({ description: 'Latest primary release date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'releaseDateLte must be in YYYY-MM-DD format' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'releaseDateLte is not a real date' },
  )
  releaseDateLte?: string;
}
