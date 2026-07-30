import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor, olderThanCursor } from './cursor.utils';

describe('cursor.utils', () => {
  describe('encodeCursor', () => {
    it('renders the (createdAt, id) tuple as <epoch-ms>_<id>', () => {
      expect(encodeCursor({ createdAt: new Date(1_730_000_000_000), id: 41 })).toBe(
        '1730000000000_41',
      );
    });
  });

  describe('decodeCursor', () => {
    it('round-trips an encoded cursor without losing milliseconds', () => {
      const row = { createdAt: new Date(1_730_000_000_123), id: 7 };

      const decoded = decodeCursor(encodeCursor(row));

      expect(decoded.createdAt.getTime()).toBe(row.createdAt.getTime());
      expect(decoded.id).toBe(row.id);
    });

    it.each([
      ['empty', ''],
      ['no separator', '1730000000000'],
      ['non-numeric timestamp', 'abc_41'],
      ['non-numeric id', '1730000000000_abc'],
      ['negative id', '1730000000000_-41'],
      ['zero id', '1730000000000_0'],
      ['extra segment', '1730000000000_41_9'],
      ['float timestamp', '1730000000000.5_41'],
      ['sql-ish payload', "1730000000000_41' OR 1=1"],
      ['absurdly long timestamp', '99999999999999999999_41'],
    ])('rejects a malformed cursor (%s) with 400', (_label, raw) => {
      expect(() => decodeCursor(raw)).toThrow(BadRequestException);
    });
  });

  describe('olderThanCursor', () => {
    it('expands the tuple comparison into strictly-older OR same-instant-lower-id', () => {
      const createdAt = new Date(1_730_000_000_000);

      expect(olderThanCursor({ createdAt, id: 41 })).toEqual([
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: 41 } },
      ]);
    });
  });
});
