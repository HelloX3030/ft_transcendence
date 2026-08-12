import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FeedQueryDto } from './feed-query.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(query: Record<string, unknown>): FeedQueryDto {
  return plainToInstance(FeedQueryDto, query);
}

describe('FeedQueryDto', () => {
  it('defaults to a full page', () => {
    const dto = build({});

    expect(dto.limit).toBe(20);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('parses the string a query param actually arrives as', () => {
    const dto = build({ limit: '5' });

    expect(dto.limit).toBe(5);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a limit below one', () => {
    expect(validateSync(build({ limit: '0' }))).not.toHaveLength(0);
  });

  // 50 is the recommendation service's own ceiling; asking for more would be
  // silently clamped upstream.
  it('rejects a limit past the recommender ceiling', () => {
    expect(validateSync(build({ limit: '50' }))).toHaveLength(0);
    expect(validateSync(build({ limit: '51' }))).not.toHaveLength(0);
  });

  it('rejects a non-numeric limit', () => {
    expect(validateSync(build({ limit: 'abc' }))).not.toHaveLength(0);
  });
});
