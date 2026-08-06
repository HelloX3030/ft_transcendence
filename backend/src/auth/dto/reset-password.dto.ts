import { ApiProperty } from '@nestjs/swagger';
import { ResetPasswordRequest } from '@cinemates/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ description: 'The token from the reset link' })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsNotEmpty()
  token!: string;

  // The same `@IsStrongPassword()` RegisterDto uses, rather than a third
  // definition of "strong" that can drift away from the other two. MaxLength
  // matters as much: argon2 on unbounded input is a cheap way to burn CPU on an
  // endpoint that needs no authentication.
  @ApiProperty({ example: 'B8skxi!dk&' })
  @IsNotEmpty()
  @IsStrongPassword()
  @MaxLength(DEFAULT_MAX_LENGTH)
  password!: string;

  @ApiProperty({
    example: '823641',
    required: false,
    description: 'Required only when the account has TOTP enabled.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/)
  @IsNotEmpty()
  otp?: string;
}
