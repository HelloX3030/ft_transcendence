import { ApiProperty } from '@nestjs/swagger';
import { watchlist_role } from '@prisma/client';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class watchlistCreateDto {
  @ApiProperty({ example: 'action movies' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'http://exapmle.com:9000/avatars/134.webp' })
  @IsString()
  @IsOptional()
  image!: string;
}

export class watchlistUpdateDto {
  @ApiProperty({ example: 'action movies' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name!: string;

  @ApiProperty({ example: 'http://exapmle.com:9000/avatars/134.webp' })
  @IsString()
  @IsOptional()
  image!: string;
}

export class watchlistDto {
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

export class watchlistsDto {
  @IsNotEmpty()
  watchlists!: watchlistDto[];
}
