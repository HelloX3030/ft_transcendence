import { ApiProperty } from '@nestjs/swagger';
import { LoginRequest } from '@cinemates/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'B8skxi!dk&' })
  @IsString()
  @MaxLength(DEFAULT_MAX_LENGTH)
  @IsNotEmpty()
  password!: string;
}
