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
