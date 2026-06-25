import { TmdbMovie } from '@trailertinder/shared';

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}
