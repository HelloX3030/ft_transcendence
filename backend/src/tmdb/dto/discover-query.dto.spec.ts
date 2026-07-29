import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DiscoverQueryDto } from './discover-query.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(query: Record<string, unknown>): DiscoverQueryDto {
  return plainToInstance(DiscoverQueryDto, query);
}

describe('DiscoverQueryDto', () => {
  it('accepts an empty query (all filters optional, inherits pagination defaults)', () => {
    const dto = build({});

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.filtered).toBe(true);
  });

  it('accepts a fully specified, valid filter set', () => {
    const dto = build({
      page: '2',
      sortBy: 'vote_average.desc',
      withGenres: '28,12,878',
      releaseDateGte: '2000-01-01',
      releaseDateLte: '2009-12-31',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  describe('sortBy', () => {
    it('accepts a whitelisted value', () => {
      expect(validateSync(build({ sortBy: 'release_date.asc' }))).toHaveLength(0);
    });

    it('rejects a value outside the whitelist', () => {
      expect(validateSync(build({ sortBy: 'budget.desc' }))).not.toHaveLength(0);
    });
  });

  describe('withGenres', () => {
    it('accepts a comma-separated list of ids', () => {
      expect(validateSync(build({ withGenres: '28,12' }))).toHaveLength(0);
    });

    it('rejects non-numeric genres', () => {
      expect(validateSync(build({ withGenres: 'action,comedy' }))).not.toHaveLength(0);
    });

    it('rejects a trailing comma', () => {
      expect(validateSync(build({ withGenres: '28,' }))).not.toHaveLength(0);
    });
  });

  describe('release date bounds', () => {
    it('accepts YYYY-MM-DD dates', () => {
      expect(
        validateSync(build({ releaseDateGte: '1999-12-31', releaseDateLte: '2020-01-01' })),
      ).toHaveLength(0);
    });

    it('rejects a malformed date', () => {
      expect(validateSync(build({ releaseDateGte: '2000' }))).not.toHaveLength(0);
    });

    it('rejects dates that match the format but are not real days', () => {
      expect(validateSync(build({ releaseDateGte: '2026-99-99' }))).not.toHaveLength(0);
      expect(validateSync(build({ releaseDateGte: '0000-00-00' }))).not.toHaveLength(0);
      expect(validateSync(build({ releaseDateLte: '2019-02-29' }))).not.toHaveLength(0);
    });

    it('accepts a leap day in a leap year', () => {
      expect(validateSync(build({ releaseDateGte: '2020-02-29' }))).toHaveLength(0);
    });

    it('rejects a full timestamp, keeping the bounds date-only', () => {
      expect(validateSync(build({ releaseDateGte: '2000-01-01T00:00:00Z' }))).not.toHaveLength(0);
    });

    it('rejects an inverted range', () => {
      const errors = validateSync(
        build({ releaseDateGte: '2020-01-01', releaseDateLte: '2010-01-01' }),
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty('isNotAfter');
    });

    it('accepts a range whose bounds are equal', () => {
      expect(
        validateSync(build({ releaseDateGte: '2020-01-01', releaseDateLte: '2020-01-01' })),
      ).toHaveLength(0);
    });

    it('does not check the ordering when only one bound is given', () => {
      expect(validateSync(build({ releaseDateGte: '2020-01-01' }))).toHaveLength(0);
      expect(validateSync(build({ releaseDateLte: '2010-01-01' }))).toHaveLength(0);
    });
  });
});
