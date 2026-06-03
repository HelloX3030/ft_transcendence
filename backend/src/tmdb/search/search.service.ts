import { Injectable } from '@nestjs/common';
import { TmdbListResponse, TmdbMovie } from '../tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

@Injectable()
export class SearchService {
  private readonly headers = {
    accept: 'application/json',
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  };

  async searchMovies(query: string): Promise<TmdbMovie[]> {
    const params = new URLSearchParams({
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });
    const res = await fetch(`${TMDB_BASE}/search/movie?${params.toString()}`, {
      headers: this.headers,
    });
    const data = (await res.json()) as TmdbListResponse;
    return data.results;
  }
}
