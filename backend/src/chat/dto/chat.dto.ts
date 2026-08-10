import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMsgSend, MESSAGE_MAX_LENGTH } from '@cinemates/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MESSAGES_DEFAULT_LIMIT = 30;
export const MESSAGES_MAX_LIMIT = 100;
export const CLIENT_MSG_ID_MAX_LENGTH = 64;

export class ChatMsgDto implements ChatMsgSend {
  @ApiProperty({ example: 641, required: true })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  peerUserId!: number;

  @ApiProperty({ maxLength: MESSAGE_MAX_LENGTH })
  // Trim first, then reject: a body of only whitespace is empty, and the column
  // is VarChar(2000), so an over-long body must fail here rather than at the DB.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  // Both carry the same sentence the service throws, so the sender reads one
  // wording whichever layer stopped the message — and never the field name,
  // which is what class-validator's defaults would put in front of them.
  @IsNotEmpty({ message: 'A message cannot be empty.' })
  @MaxLength(MESSAGE_MAX_LENGTH, {
    message: `A message cannot exceed ${MESSAGE_MAX_LENGTH} characters.`,
  })
  msg!: string;

  @ApiProperty({ description: 'Client-generated id, echoed back so tabs can dedup.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CLIENT_MSG_ID_MAX_LENGTH)
  clientMsgId!: string;
}

export class ListMessagesDto {
  @ApiPropertyOptional({
    description: 'Opaque keyset cursor: the oldest message already loaded.',
    example: '1730000000000_41',
  })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({ default: MESSAGES_DEFAULT_LIMIT, minimum: 1, maximum: MESSAGES_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGES_MAX_LIMIT)
  limit: number = MESSAGES_DEFAULT_LIMIT;
}
