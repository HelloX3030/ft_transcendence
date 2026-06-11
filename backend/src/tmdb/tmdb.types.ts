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

export interface TmdbListResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}

export interface PaginatedMovies {
  results: TmdbMovie[];
  hasMore: boolean;
}
