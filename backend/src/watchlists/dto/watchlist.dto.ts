import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  WATCHLIST_NAME_MAX_LENGTH,
  WatchlistCreateRequest,
  WatchlistUpdateRequest,
} from '@cinemates/shared';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Runs before the validators, so a whitespace-only name fails MinLength rather
 *  than being stored as blanks. The global pipe is constructed with
 *  `transform: true`, which is what makes @Transform run at all. */
const TrimName = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class watchlistCreateDto implements WatchlistCreateRequest {
  @ApiProperty({ example: 'action movies', maxLength: WATCHLIST_NAME_MAX_LENGTH })
  @IsString()
  @TrimName()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(WATCHLIST_NAME_MAX_LENGTH)
  name!: string;
}

export class watchlistUpdateDto implements WatchlistUpdateRequest {
  @ApiProperty({ example: 'action movies', required: false, maxLength: WATCHLIST_NAME_MAX_LENGTH })
  @IsString()
  @TrimName()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(WATCHLIST_NAME_MAX_LENGTH)
  @IsOptional()
  name?: string;
}
