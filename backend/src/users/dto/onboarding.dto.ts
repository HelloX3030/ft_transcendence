import { ApiProperty } from '@nestjs/swagger';
import { OnboardingRequest } from '@cinemates/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

// The frontend lets a user pick exactly this many movies (`MAX_SELECTED` in
// `frontend/src/stores/selection.ts` caps the selection; the submit button stays
// disabled below it). Mirror that contract here rather than trusting the client.
const ONBOARDING_MOVIE_COUNT = 10;

export class OnboardingDto implements OnboardingRequest {
  @ApiProperty({
    description: `TMDB ids of the movies the user picked during onboarding (exactly ${ONBOARDING_MOVIE_COUNT}, distinct)`,
    type: [Number],
    example: [27205, 157336, 24428, 155, 550, 680, 13, 120, 122, 597],
  })
  // De-dup before the size checks, so the bounds count distinct movies — otherwise
  // `[1, 1, 1, ...]` would satisfy a "pick 10" rule with one movie.
  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value) ? [...new Set<unknown>(value)] : value,
  )
  @IsArray()
  @ArrayMinSize(ONBOARDING_MOVIE_COUNT)
  @ArrayMaxSize(ONBOARDING_MOVIE_COUNT)
  @IsInt({ each: true })
  @Min(1, { each: true })
  movieIds!: number[];
}
