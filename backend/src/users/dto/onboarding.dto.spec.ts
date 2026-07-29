import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OnboardingDto } from './onboarding.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(body: Record<string, unknown>): OnboardingDto {
  return plainToInstance(OnboardingDto, body);
}

const tenIds = [27205, 157336, 24428, 155, 550, 680, 13, 120, 122, 597];

describe('OnboardingDto', () => {
  it('accepts exactly ten distinct ids', () => {
    const dto = build({ movieIds: tenIds });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.movieIds).toEqual(tenIds);
  });

  it('de-dupes before the size check, so duplicates cannot pad the list', () => {
    const dto = build({ movieIds: [...tenIds.slice(0, 9), 27205] });

    expect(dto.movieIds).toHaveLength(9);
    expect(validateSync(dto)).not.toHaveLength(0);
  });

  it('keeps the first occurrence when de-duping', () => {
    const dto = build({ movieIds: [1, 1, 2] });

    expect(dto.movieIds).toEqual([1, 2]);
  });

  it.each([
    ['fewer than ten', tenIds.slice(0, 9)],
    ['more than ten', [...tenIds, 603]],
    ['a zero id', [...tenIds.slice(0, 9), 0]],
    ['a negative id', [...tenIds.slice(0, 9), -5]],
    ['a non-integer id', [...tenIds.slice(0, 9), 1.5]],
    ['a non-array', 'not-an-array'],
  ])('rejects %s', (_name, movieIds) => {
    expect(validateSync(build({ movieIds }))).not.toHaveLength(0);
  });
});
