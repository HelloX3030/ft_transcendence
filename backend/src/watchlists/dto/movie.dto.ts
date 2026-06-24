import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { WatchlistMovieRequest } from '@trailertinder/shared';

export class watchlistMovieDto implements WatchlistMovieRequest {
  @ApiProperty({ example: 64353 })
  @IsNumber()
  tmdbId!: number;
}
