import { ApiProperty } from '@nestjs/swagger';
import { watchlist_role } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class watchlistUserDto {
  @ApiProperty({ example: '68' })
  @IsNumber()
  @IsNotEmpty()
  userId!: number;

  @ApiProperty({ example: 'editor' })
  @IsString()
  @IsEnum(watchlist_role)
  @IsNotEmpty()
  role!: watchlist_role;
}

export class watchlistRoleDto {
  @ApiProperty({ example: 'editor' })
  @IsString()
  @IsEnum(watchlist_role)
  @IsNotEmpty()
  role!: watchlist_role;
}
