import {
  TmdbCastMember,
  TmdbCrewMember,
  TmdbGenre,
  TmdbMovie,
  TmdbPerson,
} from '@cinemates/shared';

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}

// One entry from a movie's /videos results. Only the fields we use are typed.
export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
  name: string;
}

// Raw TMDB /movie/{id}?append_to_response=credits,videos,similar payload. A
// superset of what we expose as TmdbMovieDetail; only the fields we read are
// typed (the detail endpoint returns `genres`, not `genre_ids`).
export interface TmdbMovieDetailResponse extends Omit<TmdbMovie, 'genre_ids'> {
  genres: TmdbGenre[];
  runtime: number | null;
  tagline: string;
  // Appended via append_to_response; optional because TMDB may omit a section
  // (e.g. a movie with no videos), and a partial response must not crash us.
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] };
  videos?: { results: TmdbVideo[] };
  similar?: TmdbListResponse;
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
