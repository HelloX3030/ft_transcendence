import { ApiProperty } from '@nestjs/swagger';
import { language_code } from '@prisma/client';
import { UpdateUserRequest } from '@trailertinder/shared';
import { DEFAULT_MAX_LENGTH, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from 'src/utils';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto implements UpdateUserRequest {
  @ApiProperty({ example: 'alice', required: false })
  @IsOptional()
  @IsString()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  username?: string;

  @ApiProperty({ example: 'alice@example.com', required: false })
  @IsOptional()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'User language', enum: language_code, required: false })
  @IsOptional()
  @IsEnum(language_code)
  language?: language_code;

  // `image` is deliberately not writable here: avatars come only from
  // POST /users/me/avatar, which validates the bytes and owns bucket cleanup.
  // A client sending it gets a 400 from the global ValidationPipe
  // (forbidNonWhitelisted). It is still returned by ME_SELECT/PUBLIC_SELECT.
}
