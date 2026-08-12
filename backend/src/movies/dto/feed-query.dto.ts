import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT } from '../movies.service';

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
}
