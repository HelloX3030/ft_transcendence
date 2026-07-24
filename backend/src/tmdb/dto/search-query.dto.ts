import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class SearchQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Movie search term', minLength: 1, maxLength: 200 })
  // Trim before the length checks, matching how the service normalizes the term:
  // otherwise a whitespace-only query passes @MinLength(1), reaches TMDB as an
  // empty `query=` and gets its useless result cached for an hour.
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;
}
