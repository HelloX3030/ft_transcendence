import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const NOTIFICATIONS_DEFAULT_LIMIT = 20;
export const NOTIFICATIONS_MAX_LIMIT = 100;

export class ListNotificationsDto {
  @ApiPropertyOptional({
    description: 'Opaque keyset cursor from a previous page. Omit for the newest page.',
    example: '1730000000000_41',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: NOTIFICATIONS_DEFAULT_LIMIT, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_MAX_LIMIT)
  limit: number = NOTIFICATIONS_DEFAULT_LIMIT;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  // Query strings carry `true`/`false` as text; without this the validator sees
  // a non-empty string and every value would read as truthy.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly: boolean = false;
}
