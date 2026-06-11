import { Inject, Injectable } from '@nestjs/common';
import type { RedisClient } from '../../redis/redis.constants';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { TmdbClient } from '../tmdb.client';
import { PaginatedMovies } from '../tmdb.types';

const CACHE_TTL_SECONDS = 3600;
const CACHE_KEY = 'tmdb:popular:page:1';

@Injectable()
export class PopularService {
  constructor(
    private readonly client: TmdbClient,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  async fetchPopular(): Promise<PaginatedMovies> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as PaginatedMovies;

    const response = await this.client.get('/movie/popular?language=en-US&page=1');
    const result: PaginatedMovies = {
      results: response.results,
      hasMore: response.page < response.total_pages,
    };
    await this.redis.set(CACHE_KEY, JSON.stringify(result), { EX: CACHE_TTL_SECONDS });
    return result;
  }
}
