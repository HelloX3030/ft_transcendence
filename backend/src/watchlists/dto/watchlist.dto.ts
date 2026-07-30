import { ApiProperty } from '@nestjs/swagger';
import { WatchlistCreateRequest, WatchlistUpdateRequest } from '@trailertinder/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class watchlistCreateDto implements WatchlistCreateRequest {
  @ApiProperty({ example: 'action movies' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DEFAULT_MAX_LENGTH)
  name!: string;
}

export class watchlistUpdateDto implements WatchlistUpdateRequest {
  @ApiProperty({ example: 'action movies', required: false })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsOptional()
  name?: string;
}
