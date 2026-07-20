import { ApiProperty } from '@nestjs/swagger';
import { ChatMsg } from '@trailertinder/shared';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ChatMsgDto implements ChatMsg {
  @ApiProperty({ example: 641, required: true })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  peerUserId!: number;

  @IsString()
  @IsNotEmpty()
  msg!: string;
}
