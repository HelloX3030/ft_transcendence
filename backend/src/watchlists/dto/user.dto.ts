import { ApiProperty } from '@nestjs/swagger';
import { watchlist_role } from '@prisma/client';
import { WatchlistRoleRequest, WatchlistUserCreateRequest } from '@trailertinder/shared';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class watchlistUserDto implements WatchlistUserCreateRequest {
  @ApiProperty({ example: '68' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  userId!: number;

  @ApiProperty({ example: 'editor' })
  @IsString()
  @IsEnum(watchlist_role)
  @IsNotEmpty()
  role!: watchlist_role;
}

export class watchlistRoleDto implements WatchlistRoleRequest {
  @ApiProperty({ example: 'editor' })
  @IsString()
  @IsEnum(watchlist_role)
  @IsNotEmpty()
  role!: watchlist_role;
}
