import { ApiProperty } from '@nestjs/swagger';
import { LoginRequest } from '@trailertinder/shared';
import { DEFAULT_MAX_LENGTH } from 'src/utils';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

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

  @ApiProperty({ example: '823641', required: true })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  @IsOptional()
  otp?: string;
}
