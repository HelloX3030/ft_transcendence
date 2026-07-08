import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(query: Record<string, unknown>): PaginationQueryDto {
  return plainToInstance(PaginationQueryDto, query);
}

describe('PaginationQueryDto — filtered coercion', () => {
  it('defaults filtered to true when the param is absent', () => {
    const dto = build({});

    expect(dto.filtered).toBe(true);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('coerces the query string "false" to boolean false', () => {
    const dto = build({ filtered: 'false' });

    expect(dto.filtered).toBe(false);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('coerces the query string "true" to boolean true', () => {
    const dto = build({ filtered: 'true' });

    expect(dto.filtered).toBe(true);
    expect(validateSync(dto)).toHaveLength(0);
  });
});
