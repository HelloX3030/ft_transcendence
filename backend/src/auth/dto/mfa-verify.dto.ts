import { ApiProperty } from '@nestjs/swagger';
import { MfaVerifyRequest } from '@trailertinder/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class MfaVerifyDto implements MfaVerifyRequest {
  @ApiProperty({
    description:
      'The mfaToken returned by POST /auth/login. Optional: the Google callback is a redirect, ' +
      'so it leaves the token in an httpOnly `mfa_token` cookie instead, which is used when this ' +
      'field is absent.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsNotEmpty()
  mfaToken?: string;

  @ApiProperty({ example: '823641' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  @IsNotEmpty()
  otp!: string;
}
