import { ApiProperty } from '@nestjs/swagger';
import { OnboardingRequest } from '@trailertinder/shared';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class OnboardingDto implements OnboardingRequest {
  @ApiProperty({
    description: 'TMDB ids of the movies the user picked during onboarding',
    type: [Number],
    example: [27205, 157336, 24428],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  movieIds!: number[];
}
