import { ApiProperty } from '@nestjs/swagger';
import { LoginRequest } from '@trailertinder/shared';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'B8skxi!dk&' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
