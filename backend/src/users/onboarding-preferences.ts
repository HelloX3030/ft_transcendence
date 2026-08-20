import { TmdbMovieDetail } from '@cinemates/shared';

// Only the top-billed cast counts as a preference: TMDB's cast list runs to fifty
// entries of one-line parts, and tallying all of them would rank an extra who
// happened to appear twice above the lead.
const TOP_BILLED_CAST = 5;

// A person has to recur across the picks to count. Ten films yield roughly forty
// distinct actors, nearly all appearing once, which is an artefact of having
// picked a film rather than a preference. Genres have no such threshold: they always
// recur, and they are the dimension the recommender's query actually needs.
const MIN_PERSON_OCCURRENCES = 2;

export interface OnboardingLimits {
  genres: number;
  actors: number;
  directors: number;
}

export interface DerivedPreferences {
  genreIds: number[];
  actorIds: number[];
  directorIds: number[];
}

/** Count descending, ties broken by ascending TMDB id so two users with identical
 *  picks get identical profiles, an unstable order would change which genres
 *  reach the Discover query. */
function rank(counts: Map<number, number>, limit: number, minCount = 1): number[] {
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort(([idA, countA], [idB, countB]) => countB - countA || idA - idB)
    .slice(0, limit)
    .map(([id]) => id);
}

/** Tallies ids across movies, counting each id at most once per movie, a person
 *  credited twice on one film (two crew roles) is still one pick. */
function tally(movies: TmdbMovieDetail[], idsOf: (movie: TmdbMovieDetail) => number[]) {
  const counts = new Map<number, number>();
  for (const movie of movies) {
    for (const id of new Set(idsOf(movie))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Turns the movies a user picked during onboarding into the three preference
 * arrays the recommendation service seeds its profile from. Order is significant
 * and frequency-descending: the service weights every onboarding id equally and
 * then takes a fixed-size slice with a stable sort. The limits only truncate.
 */
export function derivePreferences(
  movies: TmdbMovieDetail[],
  limits: OnboardingLimits,
): DerivedPreferences {
  const genres = tally(movies, (movie) => movie.genres.map((genre) => genre.id));
  const actors = tally(movies, (movie) =>
    movie.credits.cast.slice(0, TOP_BILLED_CAST).map((member) => member.id),
  );
  // A film legitimately has two directors (the Russos), so this is a filter and
  // not a find.
  const directors = tally(movies, (movie) =>
    movie.credits.crew.filter((member) => member.job === 'Director').map((member) => member.id),
  );

  return {
    genreIds: rank(genres, limits.genres),
    actorIds: rank(actors, limits.actors, MIN_PERSON_OCCURRENCES),
    directorIds: rank(directors, limits.directors, MIN_PERSON_OCCURRENCES),
  };
}
