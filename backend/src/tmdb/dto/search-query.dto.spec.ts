import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(query: Record<string, unknown>): SearchQueryDto {
  return plainToInstance(SearchQueryDto, query);
}

describe('SearchQueryDto: query normalization', () => {
  it('trims surrounding whitespace off the search term', () => {
    const dto = build({ query: '  batman ' });

    expect(dto.query).toBe('batman');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a whitespace-only query instead of sending an empty term upstream', () => {
    const dto = build({ query: '   ' });

    const errors = validateSync(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('rejects an empty query', () => {
    expect(validateSync(build({ query: '' }))).toHaveLength(1);
  });

  it('rejects a non-string query', () => {
    const errors = validateSync(build({ query: 42 }));

    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('rejects a query longer than 200 characters', () => {
    const errors = validateSync(build({ query: 'a'.repeat(201) }));

    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('accepts a query at the length bounds', () => {
    expect(validateSync(build({ query: 'a' }))).toHaveLength(0);
    expect(validateSync(build({ query: 'a'.repeat(200) }))).toHaveLength(0);
  });

  it('still applies the inherited pagination defaults', () => {
    const dto = build({ query: 'batman' });

    expect(dto.page).toBe(1);
    expect(dto.filtered).toBe(true);
  });
});
