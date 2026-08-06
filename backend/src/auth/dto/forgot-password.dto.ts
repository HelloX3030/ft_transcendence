import { ApiProperty } from '@nestjs/swagger';
import { ForgotPasswordRequest } from '@cinemates/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsNotEmpty()
  email!: string;
}
