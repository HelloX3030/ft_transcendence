import { Injectable } from '@nestjs/common';
import { TmdbClient } from '../tmdb.client';
import { TmdbMovie } from '../tmdb.types';

@Injectable()
export class SearchService {
  constructor(private readonly client: TmdbClient) {}

  searchMovies(query: string): Promise<TmdbMovie[]> {
    const params = new URLSearchParams({
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });
    return this.client.get(`/search/movie?${params.toString()}`);
  }
}
