import { Injectable, Logger } from '@nestjs/common';
import {
  apiResponse,
  MovieWatchProviders,
  PaginatedMovies,
  TmdbGenre,
  TmdbPerson,
} from '@trailertinder/shared';
import { successResponse } from 'src/utils';
import { RedisService } from '../redis/redis.service';
import { filterMovies } from './movie-filter';
import { TmdbClient } from './tmdb.client';
import { TmdbGenreListResponse, TmdbPersonResponse } from './tmdb.types';

const CACHE_TTL_SECONDS = 3600;

// Genres are a small, near-static catalogue, so cache them under one fixed key
// and refresh only daily rather than hourly like the paginated movie endpoints.
const GENRES_CACHE_KEY = 'tmdb:genres';
const GENRES_CACHE_TTL_SECONDS = 86_400;

// A person's name/photo changes very rarely, so cache each one for a week.
const PERSON_CACHE_TTL_SECONDS = 604_800;

// Inputs for the discover feed. Structurally matched by DiscoverQueryDto, so the
// controller can forward the validated DTO straight through. All optional: an
// empty object yields the popular list (sort_by=popularity.desc, no filters).
export interface DiscoverFilters {
  page?: number;
  filtered?: boolean;
  sortBy?: string;
  withGenres?: string;
  releaseDateGte?: string;
  releaseDateLte?: string;
}

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);

  constructor(
    private readonly client: TmdbClient,
    private readonly redis: RedisService,
  ) {}

  async discoverMovies(filters: DiscoverFilters = {}): Promise<apiResponse<PaginatedMovies>> {
    const {
      page = 1,
      filtered = true,
      sortBy,
      withGenres,
      releaseDateGte,
      releaseDateLte,
    } = filters;

    // TMDB's /discover/movie is the filterable superset of /movie/popular: with
    // no filters and sort_by=popularity.desc (its default) it returns the popular
    // list, but unlike /movie/popular it also accepts genre/sort/date filters.
    const params = new URLSearchParams({
      include_adult: 'false',
      language: 'en-US',
      // `release_date.*` is the UI's name for TMDB's `primary_release_date.*`.
      sort_by: (sortBy ?? 'popularity.desc').replace(/^release_date\./, 'primary_release_date.'),
      page: String(page),
    });
    if (withGenres) params.set('with_genres', withGenres);
    if (releaseDateGte) params.set('primary_release_date.gte', releaseDateGte);
    if (releaseDateLte) params.set('primary_release_date.lte', releaseDateLte);

    // The full query string is the cache key, so every distinct filter
    // combination (and page) maps to its own entry and never collides.
    const movies = await this.getCachedMovies(
      `tmdb:discover:${params.toString()}:${filtered ? 'filtered' : 'raw'}`,
      `/discover/movie?${params}`,
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

  // Resolves TMDB person ids (e.g. a user's favorite actors/directors) to names.
  // There's no batch person endpoint, so each id is fetched and cached on its own
  // key — that way popular people are shared across users and callers get partial
  // cache hits. Unresolvable ids (stale/404) are skipped rather than failing the
  // whole batch.
  async getPeople(ids: number[]): Promise<apiResponse<TmdbPerson[]>> {
    const uniqueIds = [...new Set(ids)];
    const people = await Promise.all(uniqueIds.map((id) => this.getPerson(id)));
    return successResponse(people.filter((person): person is TmdbPerson => person !== null));
  }

  private async getPerson(id: number): Promise<TmdbPerson | null> {
    const key = `tmdb:person:${id}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as TmdbPerson;

    try {
      const response = await this.client.get<TmdbPersonResponse>(`/person/${id}?language=en-US`);
      const person: TmdbPerson = {
        id: response.id,
        name: response.name,
        profile_path: response.profile_path,
        known_for_department: response.known_for_department,
      };
      await this.redis.set(key, JSON.stringify(person), PERSON_CACHE_TTL_SECONDS);
      return person;
    } catch (error) {
      this.logger.warn(`Failed to resolve TMDB person ${id}: ${(error as Error).message}`);
      return null;
    }
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
