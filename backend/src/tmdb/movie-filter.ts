import { TmdbMovie } from './tmdb.types';

/**
 * Minimum number of user ratings for a movie to be surfaced. Unlike TMDB's
 * `popularity` (a volatile "trending right now" score that drops legitimate
 * catalog titles and breaks search), `vote_count` is a stable proxy for "enough
 * people have actually seen this". Junk and amateur uploads sit near 0 while
 * real releases are comfortably above this.
 */
export const MIN_VOTE_COUNT = 50;

/**
 * Minimum average rating (TMDB scores out of 10). Paired with MIN_VOTE_COUNT so
 * the average is only trusted once it's backed by enough votes — this drops the
 * truly panned/broken entries without thinning out legitimately mediocre films.
 */
export const MIN_VOTE_AVERAGE = 5;

/**
 * Removes movies not worth showing: those without a poster image, those with too
 * few ratings, and those rated below the quality floor. Shared by every TMDB
 * endpoint so the rules stay identical everywhere. Single source of truth — tune
 * the thresholds above to change the behaviour across all endpoints.
 */
export function filterMovies(movies: TmdbMovie[]): TmdbMovie[] {
  return movies.filter(
    (movie) =>
      movie.poster_path !== null &&
      movie.vote_count >= MIN_VOTE_COUNT &&
      movie.vote_average >= MIN_VOTE_AVERAGE,
  );
}
