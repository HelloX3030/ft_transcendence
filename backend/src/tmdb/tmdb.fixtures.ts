import { MovieWatchProviders, TmdbGenre, TmdbMovie, WatchProvider } from '@trailertinder/shared';
import {
  TmdbGenreListResponse,
  TmdbListResponse,
  TmdbMovieDetailResponse,
  TmdbPersonResponse,
} from './tmdb.types';

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

/**
 * Test-only factory: builds a raw TMDB /movie/{id} detail response (with credits,
 * videos and similar appended). Defaults include one official YouTube trailer and
 * a director in the crew. Override per test.
 */
export function makeMovieDetailResponse(
  overrides: Partial<TmdbMovieDetailResponse> = {},
): TmdbMovieDetailResponse {
  return {
    ...makeMovie(),
    genres: [makeGenre()],
    runtime: 140,
    tagline: 'Why so serious?',
    credits: {
      cast: [{ id: 11, name: 'Christian Bale', character: 'Bruce Wayne', profile_path: '/cb.jpg' }],
      crew: [
        {
          id: 12,
          name: 'Christopher Nolan',
          job: 'Director',
          department: 'Directing',
          profile_path: '/cn.jpg',
        },
      ],
    },
    videos: {
      results: [
        { key: 'trailerKey1', site: 'YouTube', type: 'Trailer', official: true, name: 'Trailer' },
      ],
    },
    similar: makeListResponse(),
    ...overrides,
  };
}

/**
 * Test-only factory: builds a raw TMDB /person/{id} response. The extra fields
 * (biography, birthday, popularity) are the ones the service must strip.
 */
export function makePersonResponse(
  overrides: Partial<TmdbPersonResponse> = {},
): TmdbPersonResponse {
  return {
    id: 287,
    name: 'Brad Pitt',
    profile_path: '/bp.jpg',
    known_for_department: 'Acting',
    biography: 'An actor.',
    birthday: '1963-12-18',
    popularity: 42.5,
    ...overrides,
  };
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
