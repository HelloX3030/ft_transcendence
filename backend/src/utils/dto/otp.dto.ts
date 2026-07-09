import { ApiProperty } from '@nestjs/swagger';
import { otp } from '@trailertinder/shared';
import { IsString, Matches } from 'class-validator';

export class otpDto implements otp {
  @ApiProperty({ example: '823641', required: true })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  otp!: string;
}
