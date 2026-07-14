import { ApiProperty } from '@nestjs/swagger';
import { ChatRequest } from '@trailertinder/shared';
import { IsNumber } from 'class-validator';

export class ChatRequestDto implements ChatRequest {
  @ApiProperty({ example: '641', required: true })
  @IsNumber()
  userId!: number;
}
