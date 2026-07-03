import { TmdbGenre, TmdbMovie, TmdbPerson } from '@trailertinder/shared';

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}

export interface TmdbGenreListResponse {
  genres: TmdbGenre[];
}

// Raw TMDB /person/{id} payload. A superset of the public TmdbPerson; only the
// fields we expose are typed here.
export interface TmdbPersonResponse extends TmdbPerson {
  biography: string;
  birthday: string | null;
  popularity: number;
}
