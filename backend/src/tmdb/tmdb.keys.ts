// Every Redis key this module writes is built here, so the conventions stay in
// one place instead of being reassembled inline at each call site.
//
// The version segment is the invalidation lever: cached payloads are reshaped
// DTOs, not raw TMDB bodies, so changing one of those shapes (say, adding a
// field to TmdbMovieDetail) would otherwise leave old-shape JSON to be parsed
// into the new type and served until its TTL runs out. Bump CACHE_VERSION in the
// same commit as such a change and the old entries are orphaned instead.
const CACHE_VERSION = 'v1';
const PREFIX = `tmdb:${CACHE_VERSION}`;

// Filtered and unfiltered variants of the same query must never share an entry.
const variant = (filtered: boolean): string => (filtered ? 'filtered' : 'raw');

export const cacheKeys = {
  // `params` is the full TMDB query string, so every distinct filter
  // combination (and page) maps to its own entry and never collides.
  discover: (params: string, filtered: boolean): string =>
    `${PREFIX}:discover:${params}:${variant(filtered)}`,

  // The search term is already normalized (trimmed, lowercased) by the caller.
  search: (query: string, page: number, filtered: boolean): string =>
    `${PREFIX}:search:${query}:page:${page}:${variant(filtered)}`,

  movie: (movieId: number): string => `${PREFIX}:movie:${movieId}`,

  providers: (movieId: number): string => `${PREFIX}:providers:movie:${movieId}`,

  person: (personId: number): string => `${PREFIX}:person:${personId}`,

  genres: (): string => `${PREFIX}:genres`,
} as const;
