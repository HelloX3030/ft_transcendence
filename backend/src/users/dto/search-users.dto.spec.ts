import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SearchUsersDto } from './search-users.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(query: Record<string, unknown>): SearchUsersDto {
  return plainToInstance(SearchUsersDto, query);
}

describe('SearchUsersDto — query trimming', () => {
  it('trims surrounding whitespace off the search term', () => {
    const dto = build({ query: '  alice  ' });

    expect(dto.query).toBe('alice');
    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([[' '], ['   '], ['\t\n']])('rejects the whitespace-only query %j', (query) => {
    expect(validateSync(build({ query }))).not.toHaveLength(0);
  });
});
