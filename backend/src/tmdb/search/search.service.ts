import { Inject, Injectable } from '@nestjs/common';
import type { RedisClient } from '../../redis/redis.constants';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { TmdbClient } from '../tmdb.client';
import { TmdbMovie } from '../tmdb.types';

const CACHE_TTL_SECONDS = 3600;

@Injectable()
export class SearchService {
  constructor(
    private readonly client: TmdbClient,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  async searchMovies(query: string): Promise<TmdbMovie[]> {
    const key = `tmdb:search:${query}:page:1`;

    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as TmdbMovie[];

    const params = new URLSearchParams({
      query,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });
    const results = await this.client.get(`/search/movie?${params.toString()}`);
    await this.redis.set(key, JSON.stringify(results), { EX: CACHE_TTL_SECONDS });
    return results;
  }
}
