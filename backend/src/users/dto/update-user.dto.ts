import { ApiProperty } from '@nestjs/swagger';
import { language_code } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'alice', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'alice@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'User language', enum: language_code, required: false })
  @IsOptional()
  @IsEnum(language_code)
  language?: language_code;

  @ApiProperty({ example: 'https://example.com/avatar.png', required: false })
  @IsOptional()
  @IsString()
  @IsUrl()
  image?: string;
}
