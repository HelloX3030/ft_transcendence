import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { filterMovies } from '../movie-filter';
import { TmdbClient } from '../tmdb.client';
import { PaginatedMovies } from '../tmdb.types';

const CACHE_TTL_SECONDS = 3600;

@Injectable()
export class SearchService {
  constructor(
    private readonly client: TmdbClient,
    private readonly redis: RedisService,
  ) {}

  async searchMovies(query: string, page = 1): Promise<PaginatedMovies> {
    const key = `tmdb:search:${query}:page:${page}`;

    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as PaginatedMovies;

    const params = new URLSearchParams({
      query,
      include_adult: 'false',
      language: 'en-US',
      page: String(page),
    });
    const response = await this.client.get(`/search/movie?${params.toString()}`);
    const result: PaginatedMovies = {
      results: filterMovies(response.results),
      hasMore: response.page < response.total_pages,
    };
    await this.redis.set(key, JSON.stringify(result), CACHE_TTL_SECONDS);
    return result;
  }
}
