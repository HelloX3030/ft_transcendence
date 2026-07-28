import { ApiProperty } from '@nestjs/swagger';
import { MfaVerifyRequest } from '@trailertinder/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class MfaVerifyDto implements MfaVerifyRequest {
  @ApiProperty({ description: 'The mfaToken returned by POST /auth/login' })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsNotEmpty()
  mfaToken!: string;

  @ApiProperty({ example: '823641' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  @IsNotEmpty()
  otp!: string;
}
