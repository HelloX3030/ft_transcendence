import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'TMDB result page', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Apply the popularity/poster quality filter to the results',
    default: true,
  })
  @IsOptional()
  // Query params arrive as strings; only the literal "false" disables the filter
  // (Boolean('false') would be true, so we compare explicitly).
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  filtered: boolean = true;
}
