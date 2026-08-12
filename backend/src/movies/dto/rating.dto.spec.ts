import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ratingDto } from './rating.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(body: Record<string, unknown>): ratingDto {
  return plainToInstance(ratingDto, body);
}

describe('ratingDto', () => {
  it.each(['like', 'dislike'])('accepts %s', (reaction) => {
    expect(validateSync(build({ reaction }))).toHaveLength(0);
  });

  it.each([['love'], [''], [null], ['LIKE']])('rejects %p', (reaction) => {
    expect(validateSync(build({ reaction }))).not.toHaveLength(0);
  });

  it('rejects a missing reaction', () => {
    expect(validateSync(build({}))).not.toHaveLength(0);
  });
});
