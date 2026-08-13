import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { FEED_DEFAULT_LIMIT, FEED_MAX_EXCLUDE, FEED_MAX_LIMIT } from '../movies.service';

export class FeedQueryDto {
  @ApiPropertyOptional({
    description: 'How many playable cards to return',
    minimum: 1,
    maximum: FEED_MAX_LIMIT,
    default: FEED_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // The recommendation service's own ceiling, from its request schema.
  @Max(FEED_MAX_LIMIT)
  limit: number = FEED_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description:
      'Comma-separated TMDB ids the caller has already shown. Kept out of the response, so ' +
      'asking again returns the next films rather than the same ones. Silently capped at the ' +
      `most recent ${FEED_MAX_EXCLUDE}; unparseable entries are ignored.`,
    type: String,
    example: '550,155,27205',
  })
  @IsOptional()
  // Parsed rather than validated into a 400: this list is a client-side cache of
  // what it has on screen, and rejecting the request because it grew too long
  // would break the feed for the users who had used it the most.
  @Transform(({ value }): number[] => {
    if (typeof value !== 'string' || value.length === 0) return [];
    const ids = value
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return [...new Set(ids)].slice(-FEED_MAX_EXCLUDE);
  })
  @IsInt({ each: true })
  exclude: number[] = [];
}
