import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class watchlistMovieDto {
  @ApiProperty({ example: '64353' })
  @IsNumber()
  tmdbId!: number;
}
