import { ApiProperty } from '@nestjs/swagger';
import { LoginRequest } from '@trailertinder/shared';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'B8skxi!dk&' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiProperty({ example: '823641', required: true })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  @IsOptional()
  otp?: string;
}
