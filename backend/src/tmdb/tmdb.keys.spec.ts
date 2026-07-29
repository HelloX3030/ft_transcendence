import { cacheKeys } from './tmdb.keys';

describe('cacheKeys', () => {
  const allKeys = [
    cacheKeys.discover('page=1', true),
    cacheKeys.search('batman', 1, true),
    cacheKeys.movie(1),
    cacheKeys.providers(1),
    cacheKeys.person(1),
    cacheKeys.genres(),
  ];

  it('namespaces and versions every key so a shape change can orphan the old ones', () => {
    for (const key of allKeys) {
      expect(key.startsWith('tmdb:v1:')).toBe(true);
    }
  });

  it('gives each endpoint a distinct key for the same id', () => {
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  it('separates the filtered and unfiltered variants of one query', () => {
    expect(cacheKeys.discover('page=1', true)).not.toBe(cacheKeys.discover('page=1', false));
    expect(cacheKeys.search('batman', 1, true)).not.toBe(cacheKeys.search('batman', 1, false));
  });

  it('separates pages of the same search term', () => {
    expect(cacheKeys.search('batman', 1, true)).not.toBe(cacheKeys.search('batman', 2, true));
  });
});
