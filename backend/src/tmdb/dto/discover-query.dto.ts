import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
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

// Optional discover filters layered on top of pagination + the quality toggle.
// All go straight into the TMDB /discover/movie request, so each is validated
// to a strict shape (sort_by is whitelisted; genres/dates are format-checked).
export class DiscoverQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ description: 'Earliest primary release date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'releaseDateGte must be in YYYY-MM-DD format' })
  releaseDateGte?: string;

  @ApiPropertyOptional({ description: 'Latest primary release date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'releaseDateLte must be in YYYY-MM-DD format' })
  releaseDateLte?: string;
}
