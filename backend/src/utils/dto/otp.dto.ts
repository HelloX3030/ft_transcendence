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
 * Same code, same validation, same Swagger example — derived from `otpDto` rather
 * than restated so the two cannot drift.
 *
 * `otp` is optional only because disabling an *inactive* TOTP takes no code (an
 * abandoned setup has nothing to protect and no scanned QR to read one from).
 * When 2FA is actually on, `deleteTOTP` requires it.
 */
export class disableTotpDto extends PartialType(otpDto) {}
