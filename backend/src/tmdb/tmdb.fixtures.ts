import { TmdbMovie } from '@trailertinder/shared';

/**
 * Test-only factory: builds a complete TmdbMovie with valid defaults (has a
 * poster, popularity above the filter threshold). Override what the test
 * cares about.
 */
export function makeMovie(overrides: Partial<TmdbMovie> = {}): TmdbMovie {
  return {
    id: 1,
    title: 'Batman Begins',
    original_title: 'Batman Begins',
    overview: 'A superhero film',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    release_date: '2005-06-15',
    vote_average: 8.2,
    vote_count: 12000,
    popularity: 50.5,
    genre_ids: [28, 18],
    original_language: 'en',
    adult: false,
    video: false,
    ...overrides,
  };
}
