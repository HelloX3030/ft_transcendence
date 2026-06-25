import { Injectable } from '@nestjs/common';
import {
  apiResponse,
  MovieWatchProviders,
  PaginatedMovies,
  TmdbGenre,
} from '@trailertinder/shared';
import { successResponse } from 'src/utils';
import { RedisService } from '../redis/redis.service';
import { filterMovies } from './movie-filter';
import { TmdbClient } from './tmdb.client';
import { TmdbGenreListResponse } from './tmdb.types';

const CACHE_TTL_SECONDS = 3600;

// Genres are a small, near-static catalogue, so cache them under one fixed key
// and refresh only daily rather than hourly like the paginated movie endpoints.
const GENRES_CACHE_KEY = 'tmdb:genres';
const GENRES_CACHE_TTL_SECONDS = 86_400;

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

  async getWatchProviders(movieId: number): Promise<apiResponse<MovieWatchProviders>> {
    const key = `tmdb:providers:movie:${movieId}`;
    const cached = await this.redis.get(key);
    if (cached) return successResponse(JSON.parse(cached) as MovieWatchProviders);

    // TMDB returns { id, results: { <country>: { link, flatrate, rent, buy } } }
    // which already matches MovieWatchProviders, so it's cached and returned as-is.
    const response = await this.client.get<MovieWatchProviders>(
      `/movie/${movieId}/watch/providers`,
    );
    await this.redis.set(key, JSON.stringify(response), CACHE_TTL_SECONDS);
    return successResponse(response);
  }

  async getGenres(): Promise<apiResponse<TmdbGenre[]>> {
    const cached = await this.redis.get(GENRES_CACHE_KEY);
    if (cached) return successResponse(JSON.parse(cached) as TmdbGenre[]);

    const response = await this.client.get<TmdbGenreListResponse>(
      '/genre/movie/list?language=en-US',
    );
    await this.redis.set(
      GENRES_CACHE_KEY,
      JSON.stringify(response.genres),
      GENRES_CACHE_TTL_SECONDS,
    );
    return successResponse(response.genres);
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
