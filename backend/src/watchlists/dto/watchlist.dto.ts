import { ApiProperty } from '@nestjs/swagger';
import { watchlist_role } from '@prisma/client';
import {
  WatchlistCreateRequest,
  WatchlistResponse,
  WatchlistUpdateRequest,
} from '@trailertinder/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class watchlistCreateDto implements WatchlistCreateRequest {
  @ApiProperty({ example: 'action movies' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DEFAULT_MAX_LENGTH)
  name!: string;

  @ApiProperty({ example: 'http://exapmle.com:9000/avatars/134.webp', required: false })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsUrl()
  @IsOptional()
  image?: string;
}

export class watchlistUpdateDto implements WatchlistUpdateRequest {
  @ApiProperty({ example: 'action movies', required: false })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'http://exapmle.com:9000/avatars/134.webp', required: false })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsUrl()
  @IsOptional()
  image?: string;
}
