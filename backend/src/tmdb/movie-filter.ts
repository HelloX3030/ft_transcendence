import { TmdbMovie } from './tmdb.types';

/**
 * Minimum TMDB popularity score for a movie to be surfaced. Anything below this
 * is treated as long-tail noise (effectively unwatched) and dropped. Obscure
 * titles sit near 0 while real releases are comfortably above this, so the cut
 * removes junk without thinning out legitimate results. Single source of truth —
 * tune here to change the behaviour across every TMDB endpoint.
 */
export const MIN_POPULARITY = 10;

/**
 * Removes movies not worth showing: those without a poster image and those below
 * the popularity threshold. Shared by every TMDB endpoint so the rules stay
 * identical everywhere.
 */
export function filterMovies(movies: TmdbMovie[]): TmdbMovie[] {
  return movies.filter((movie) => movie.poster_path !== null && movie.popularity >= MIN_POPULARITY);
}
