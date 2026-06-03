import { Injectable } from '@nestjs/common';
import { TmdbListResponse, TmdbMovie } from '../tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

@Injectable()
export class PopularService {
  private readonly headers = {
    accept: 'application/json',
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  };

  async fetchPopular(): Promise<TmdbMovie[]> {
    if (!process.env.TMDB_API_KEY) return [];
    const res = await fetch(`${TMDB_BASE}/movie/popular?language=en-US&page=1`, {
      headers: this.headers,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as TmdbListResponse;
    return data.results;
  }
}
