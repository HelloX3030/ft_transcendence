import { ApiProperty } from '@nestjs/swagger';
import { WatchlistCreateRequest, WatchlistUpdateRequest } from '@trailertinder/shared';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
