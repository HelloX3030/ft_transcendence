import { Injectable } from '@nestjs/common';
import { apiResponse, PaginatedMovies } from '@trailertinder/shared';
import { successResponse } from 'src/utils';
import { RedisService } from '../redis/redis.service';
import { filterMovies } from './movie-filter';
import { TmdbClient } from './tmdb.client';

const CACHE_TTL_SECONDS = 3600;

@Injectable()
export class TmdbService {
  constructor(
    private readonly client: TmdbClient,
    private readonly redis: RedisService,
  ) {}

  async fetchPopular(page = 1, filtered = true): Promise<apiResponse<PaginatedMovies>> {
    const movies = await this.getCachedMovies(
      `tmdb:popular:page:${page}:${filtered ? 'filtered' : 'raw'}`,
      `/movie/popular?language=en-US&page=${page}`,
      filtered,
    );
    return successResponse(movies);
  }

  async searchMovies(
    query: string,
    page = 1,
    filtered = true,
  ): Promise<apiResponse<PaginatedMovies>> {
    // Normalized so 'Batman', 'batman' and ' batman ' share one cache entry —
    // TMDB search is case-insensitive, so the results are identical anyway.
    const normalized = query.trim().toLowerCase();
    const params = new URLSearchParams({
      query: normalized,
      include_adult: 'false',
      language: 'en-US',
      page: String(page),
    });
    const movies = await this.getCachedMovies(
      `tmdb:search:${normalized}:page:${page}:${filtered ? 'filtered' : 'raw'}`,
      `/search/movie?${params}`,
      filtered,
    );
    return successResponse(movies);
  }

  // Cache-through fetch shared by every TMDB endpoint: serve the cached page
  // if present, otherwise fetch from TMDB, optionally filter, cache, and return.
  // `filtered` is part of the cache key (see callers) so the two variants never
  // collide.
  private async getCachedMovies(
    key: string,
    path: string,
    filtered: boolean,
  ): Promise<PaginatedMovies> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as PaginatedMovies;

    const response = await this.client.get(path);
    const result: PaginatedMovies = {
      results: filtered ? filterMovies(response.results) : response.results,
      hasMore: response.page < response.total_pages,
      totalResults: response.total_results,
    };
    await this.redis.set(key, JSON.stringify(result), CACHE_TTL_SECONDS);
    return result;
  }
}
