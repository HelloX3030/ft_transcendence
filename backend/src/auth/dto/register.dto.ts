import { ApiProperty } from '@nestjs/swagger';
import { language_code } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, IsStrongPassword } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'bob' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'bob@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'B8skxi!dk&' })
  @IsNotEmpty()
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ description: 'User language', enum: language_code })
  @IsNotEmpty()
  @IsEnum(language_code)
  language!: language_code;
}
