import { TmdbGenre, TmdbMovie } from '@trailertinder/shared';

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}

export interface TmdbGenreListResponse {
  genres: TmdbGenre[];
}
