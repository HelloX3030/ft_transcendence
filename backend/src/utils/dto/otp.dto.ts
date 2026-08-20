import { ApiProperty, PartialType } from '@nestjs/swagger';
import { otp } from '@cinemates/shared';
import { IsString, Matches } from 'class-validator';

export class otpDto implements otp {
  @ApiProperty({ example: '823641', required: true })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  otp!: string;
}

/**
 * Derived from `otpDto` rather than restated, so the two cannot drift. `otp` is
 * optional only because disabling an inactive TOTP takes no code; when 2FA is on,
 * `deleteTOTP` requires it.
 */
export class disableTotpDto extends PartialType(otpDto) {}
