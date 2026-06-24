import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';
import { WatchlistMovieRequest } from '@trailertinder/shared';

export class watchlistMovieDto implements WatchlistMovieRequest {
  @ApiProperty({ example: 64353 })
  @IsNumber()
  @Min(0)
  tmdbId!: number;
}
