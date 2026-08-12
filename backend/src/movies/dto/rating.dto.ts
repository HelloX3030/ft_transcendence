import { ApiProperty } from '@nestjs/swagger';
import { reaction_type } from '@prisma/client';
import { MovieReactionRequest } from '@cinemates/shared';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ratingDto implements MovieReactionRequest {
  @ApiProperty({ example: 'like', enum: reaction_type })
  @IsNotEmpty()
  @IsEnum(reaction_type)
  reaction!: reaction_type;
}
