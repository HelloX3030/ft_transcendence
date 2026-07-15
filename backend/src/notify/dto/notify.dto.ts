import { ApiProperty } from '@nestjs/swagger';
import { ChatMsg } from '@trailertinder/shared';
import { IsNumber, IsString } from 'class-validator';

export class ChatMsgDto implements ChatMsg {
  @ApiProperty({ example: '641', required: true })
  @IsNumber()
  peerUserId!: number;

  @IsString()
  msg!: string;
}
