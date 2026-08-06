import { describe, expect, it } from 'vitest';
import { WATCHLIST_NAME_MAX_LENGTH } from '@cinemates/shared';
import { createListSchema, updateListSchema } from './schemas';

describe('watchlist name schema', () => {
  it('rejects a name over the shared limit', () => {
    const name = 'x'.repeat(WATCHLIST_NAME_MAX_LENGTH + 1);

    expect(createListSchema.safeParse({ name }).success).toBe(false);
    expect(updateListSchema.safeParse({ name }).success).toBe(false);
  });

  it('accepts a name exactly at the limit', () => {
    const name = 'x'.repeat(WATCHLIST_NAME_MAX_LENGTH);

    expect(createListSchema.safeParse({ name }).success).toBe(true);
  });

  // z.string().min(1) accepts "   ", which is how a list with an empty heading
  // became creatable.
  it('rejects a whitespace-only name', () => {
    expect(createListSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(updateListSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('trims surrounding whitespace, so the trimmed value is what gets sent', () => {
    const result = createListSchema.safeParse({ name: '  ok  ' });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('ok');
  });

  // The edit dialog leaves the name out entirely when it was not touched.
  it('allows the name to be omitted on update', () => {
    expect(updateListSchema.safeParse({}).success).toBe(true);
  });
});
