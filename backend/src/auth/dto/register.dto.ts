import { ApiProperty } from '@nestjs/swagger';
import { language_code } from '@prisma/client';
import { RegisterRequest } from '@cinemates/shared';
import { DEFAULT_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from 'src/utils';

import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'bob' })
  @IsString()
  @IsNotEmpty()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  username!: string;

  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(DEFAULT_MAX_LENGTH)
  email!: string;

  @ApiProperty({ example: 'B8skxi!dk&' })
  @IsNotEmpty()
  @IsStrongPassword()
  @MaxLength(DEFAULT_MAX_LENGTH)
  password!: string;

  @ApiProperty({ description: 'User language', enum: language_code })
  @IsNotEmpty()
  @IsEnum(language_code)
  language!: language_code;
}
