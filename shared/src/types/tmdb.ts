/**
 * Query for GET /tmdb/discover. `DiscoverQueryDto` implements this, so a rename
 * on either side is a type error rather than a 400 at runtime — the global
 * ValidationPipe runs with `forbidNonWhitelisted`, which turns an unrecognised
 * parameter into a rejected request.
 */
export interface DiscoverQuery {
  page?: number;
  filtered?: boolean;
  sortBy?: string;
  withGenres?: string;
  releaseDateGte?: string;
  releaseDateLte?: string;
}

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  adult: boolean;
  video: boolean;
}

export interface PaginatedMovies {
  results: TmdbMovie[];
  hasMore: boolean;
  // TMDB's total match count for the query (unfiltered — see TmdbService).
  totalResults: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbPerson {
  id: number;
  name: string;
  profile_path: string | null;
  // TMDB's primary department, e.g. "Acting" | "Directing".
  known_for_department: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  // TMDB role, e.g. "Director" | "Screenplay"; used to surface the director.
  job: string;
  department: string;
  profile_path: string | null;
}

// A single movie's full detail page. Mirrors TMDB's /movie/{id} field names
// (note: `genres` objects here, not the list endpoints' `genre_ids`), plus two
// fields the backend derives from append_to_response so the client stays simple:
// `trailerKey` (picked from the videos list) and `similar` (flattened from the
// paginated similar-movies response).
export interface TmdbMovieDetail extends Omit<TmdbMovie, 'genre_ids'> {
  genres: TmdbGenre[];
  runtime: number | null;
  tagline: string;
  credits: {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
  };
  trailerKey: string | null;
  similar: TmdbMovie[];
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

// One country's availability. Any of the three buckets may be absent when a
// movie isn't offered that way in the region.
export interface WatchProviderRegion {
  link: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

export interface MovieWatchProviders {
  id: number;
  // Keyed by ISO 3166-1 country code (e.g. "DE", "US").
  results: Record<string, WatchProviderRegion>;
}
