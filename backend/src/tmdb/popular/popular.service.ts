import { Inject, Injectable } from '@nestjs/common';
import type { RedisClient } from '../../redis/redis.constants';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { filterMovies } from '../movie-filter';
import { TmdbClient } from '../tmdb.client';
import { PaginatedMovies } from '../tmdb.types';

const CACHE_TTL_SECONDS = 3600;

@Injectable()
export class PopularService {
  constructor(
    private readonly client: TmdbClient,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  async fetchPopular(page = 1): Promise<PaginatedMovies> {
    const key = `tmdb:popular:page:${page}`;

    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as PaginatedMovies;

    const response = await this.client.get(`/movie/popular?language=en-US&page=${page}`);
    const result: PaginatedMovies = {
      results: filterMovies(response.results),
      hasMore: response.page < response.total_pages,
    };
    await this.redis.set(key, JSON.stringify(result), { EX: CACHE_TTL_SECONDS });
    return result;
  }
}
