import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsInt } from 'class-validator';

// Upper bound on a single lookup, guarding against abuse and runaway fan-out to
// TMDB (one request per uncached id).
const MAX_IDS = 50;

export class PeopleQueryDto {
  @ApiProperty({
    description: 'Comma-separated TMDB person ids to resolve',
    example: '287,500,1245',
  })
  // Query arrives as "287,500" (or, if repeated, an array); split into numbers,
  // dropping blanks. Non-numeric entries become NaN and are rejected by @IsInt.
  @Transform(({ value }: { value: unknown }): number[] => {
    const parts = Array.isArray(value)
      ? (value as unknown[]).map(String)
      : typeof value === 'string'
        ? value.split(',')
        : [];
    return parts
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map(Number);
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IDS)
  @IsInt({ each: true })
  ids!: number[];
}
