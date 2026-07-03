import { MovieWatchProviders, TmdbGenre, TmdbMovie, WatchProvider } from '@trailertinder/shared';
import { TmdbGenreListResponse, TmdbListResponse } from './tmdb.types';

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

/**
 * Test-only factory: builds a TMDB list response with valid defaults (one page,
 * one movie). Override page/total_pages/total_results/results per test.
 */
export function makeListResponse(overrides: Partial<TmdbListResponse> = {}): TmdbListResponse {
  return {
    results: [makeMovie()],
    page: 1,
    total_pages: 1,
    total_results: 1,
    ...overrides,
  };
}

/** Test-only factory: builds a TmdbGenre with valid defaults. */
export function makeGenre(overrides: Partial<TmdbGenre> = {}): TmdbGenre {
  return { id: 28, name: 'Action', ...overrides };
}

/** Test-only factory: builds a TMDB genre-list response with one genre by default. */
export function makeGenreListResponse(
  overrides: Partial<TmdbGenreListResponse> = {},
): TmdbGenreListResponse {
  return { genres: [makeGenre()], ...overrides };
}

/** Test-only factory: builds a WatchProvider with valid defaults. */
export function makeWatchProvider(overrides: Partial<WatchProvider> = {}): WatchProvider {
  return {
    provider_id: 8,
    provider_name: 'Netflix',
    logo_path: '/netflix.jpg',
    display_priority: 0,
    ...overrides,
  };
}

/** Test-only factory: builds a movie watch-providers response with one DE flatrate provider. */
export function makeWatchProviders(
  overrides: Partial<MovieWatchProviders> = {},
): MovieWatchProviders {
  return {
    id: 1,
    results: { DE: { link: 'https://tmdb.org/movie/1/watch', flatrate: [makeWatchProvider()] } },
    ...overrides,
  };
}
