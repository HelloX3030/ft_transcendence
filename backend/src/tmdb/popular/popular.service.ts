import { Injectable } from '@nestjs/common';
import { TmdbClient } from '../tmdb.client';
import { TmdbMovie } from '../tmdb.types';

@Injectable()
export class PopularService {
  constructor(private readonly client: TmdbClient) {}

  fetchPopular(): Promise<TmdbMovie[]> {
    return this.client.get('/movie/popular?language=en-US&page=1');
  }
}
