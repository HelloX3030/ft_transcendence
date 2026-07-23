import { ApiProperty } from '@nestjs/swagger';
import { OnboardingRequest } from '@trailertinder/shared';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class OnboardingDto implements OnboardingRequest {
  @ApiProperty({
    description: 'TMDB ids of the movies the user picked during onboarding (at least 10)',
    type: [Number],
    example: [27205, 157336, 24428, 155, 550, 680, 13, 120, 122, 597],
  })
  @IsArray()
  @ArrayMinSize(10)
  @IsInt({ each: true })
  movieIds!: number[];
}
