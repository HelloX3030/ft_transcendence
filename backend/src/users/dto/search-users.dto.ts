import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USERNAME_MAX_LENGTH } from 'src/utils';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SearchUsersDto {
  @ApiProperty({ description: 'Username search term', minLength: 1, maxLength: 32 })
  @IsString()
  @MinLength(1)
  @MaxLength(USERNAME_MAX_LENGTH)
  query!: string;

  @ApiPropertyOptional({ description: 'Result page (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Results per page', minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
