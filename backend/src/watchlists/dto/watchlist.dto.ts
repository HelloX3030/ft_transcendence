import { ApiProperty } from '@nestjs/swagger';
import { watchlist_role } from '@prisma/client';
import {
  WatchlistCreateRequest,
  WatchlistResponse,
  WatchlistUpdateRequest,
} from '@trailertinder/shared';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class watchlistCreateDto implements WatchlistCreateRequest {
  @ApiProperty({ example: 'action movies' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'http://exapmle.com:9000/avatars/134.webp', required: false })
  @IsString()
  @IsOptional()
  image?: string;
}

export class watchlistUpdateDto implements WatchlistUpdateRequest {
  @ApiProperty({ example: 'action movies', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'http://exapmle.com:9000/avatars/134.webp', required: false })
  @IsString()
  @IsOptional()
  image?: string;
}

export class watchlistDto implements WatchlistResponse {
  @IsNumber()
  @IsNotEmpty()
  id!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  image!: string | null;

  @IsString()
  @IsNotEmpty()
  role!: watchlist_role;

  @IsDateString()
  @IsNotEmpty()
  createdAt!: Date;
}
