import { ApiProperty } from '@nestjs/swagger';
import { UpdateUserRequest, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@cinemates/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  // `avatarFileId` is deliberately not writable here: avatars come only from
  // POST /users/me/avatar, which validates the bytes and owns bucket cleanup,
  // and go away via DELETE /users/me/avatar. Writable, it would let a client
  // point their profile at someone else's file row. A client sending it gets a
  // 400 from the global ValidationPipe (forbidNonWhitelisted). It is still
  // returned by ME_SELECT/PUBLIC_SELECT.
}
