import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { TmdbClient } from './tmdb.client';
import { PaginatedMovies, TmdbGenre, TmdbMovie } from '@trailertinder/shared';
import { successResponse } from 'src/utils';
import {
  makeGenre,
  makeGenreListResponse,
  makeListResponse,
  makeMovie,
  makeWatchProviders,
} from './tmdb.fixtures';
import { TmdbService } from './tmdb.service';

const mockMovies: TmdbMovie[] = [makeMovie()];

// A movie the quality filter always rejects (no poster, zero popularity).
const junkMovie: TmdbMovie = makeMovie({ id: 99, poster_path: null, popularity: 0 });

// page 1 of 5 — more pages available, so hasMore is true.
const multiPageResponse = makeListResponse({
  results: mockMovies,
  total_pages: 5,
  total_results: 100,
});
const expectedMultiPage: PaginatedMovies = {
  results: mockMovies,
  hasMore: true,
  totalResults: 100,
};

// page 1 of 1 — no more pages, so hasMore is false.
const lastPageResponse = makeListResponse({ results: mockMovies });
const expectedLastPage: PaginatedMovies = { results: mockMovies, hasMore: false, totalResults: 1 };

const emptyResponse = makeListResponse({ results: [], page: 0, total_pages: 0, total_results: 0 });
const expectedEmpty: PaginatedMovies = { results: [], hasMore: false, totalResults: 0 };

const mockTmdbClient = {
  get: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbClient>>;

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
};

// Asserts the result was cached under `key` with the raw payload and given TTL
// (defaults to the standard 1h used by the paginated movie endpoints).
function expectCached(key: string, payload: unknown, ttl = 3600): void {
  expect(mockRedisClient.set).toHaveBeenCalledWith(key, JSON.stringify(payload), ttl);
}

describe('TmdbService', () => {
  let service: TmdbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbService,
        { provide: TmdbClient, useValue: mockTmdbClient },
        { provide: RedisService, useValue: mockRedisClient },
      ],
    }).compile();
    service = module.get<TmdbService>(TmdbService);
    jest.clearAllMocks();
    // Default to a cache miss; the cache-hit tests override get() per-test.
    mockRedisClient.get.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchPopular — cache miss', () => {
    it('calls client.get with the popular endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.fetchPopular();

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=1');
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      const result = await service.fetchPopular();

      expect(result).toEqual(successResponse(expectedMultiPage));
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.fetchPopular();

      expectCached('tmdb:popular:page:1:filtered', expectedMultiPage);
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.fetchPopular();

      expect(result).toEqual(successResponse(expectedEmpty));
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.fetchPopular(4);

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=4');
      expectCached('tmdb:popular:page:4:filtered', expectedMultiPage);
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.fetchPopular()).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('filters out movies without a poster or below the popularity threshold', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeListResponse({
          results: [...mockMovies, junkMovie],
          total_pages: 5,
          total_results: 100,
        }),
      );

      const result = await service.fetchPopular();

      expect(result.data?.results).toEqual(mockMovies);
    });
  });

  describe('fetchPopular — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedMultiPage));

      const result = await service.fetchPopular();

      expect(result).toEqual(successResponse(expectedMultiPage));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  describe('searchMovies — cache miss', () => {
    it('calls client.get with a path containing the encoded query params', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.searchMovies('batman');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('query=batman'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_adult=false'),
      );
      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('language=en-US'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=1'));
    });

    it('URL-encodes special characters in the query', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.searchMovies('star wars');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('star+wars'));
    });

    it('normalizes the query for both the cache key and the TMDB request', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('  Batman ');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('query=batman'));
      expectCached('tmdb:search:batman:page:1:filtered', expectedLastPage);
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(successResponse(expectedLastPage));
    });

    it('sets hasMore to true when more pages are available', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(successResponse(expectedMultiPage));
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman');

      expectCached('tmdb:search:batman:page:1:filtered', expectedLastPage);
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman', 3);

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=3'));
      expectCached('tmdb:search:batman:page:3:filtered', expectedLastPage);
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.searchMovies('unknownquery');

      expect(result).toEqual(successResponse(expectedEmpty));
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.searchMovies('batman')).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('filters out movies without a poster or below the popularity threshold', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeListResponse({ results: [...mockMovies, junkMovie], total_results: 2 }),
      );

      const result = await service.searchMovies('batman');

      expect(result.data?.results).toEqual(mockMovies);
    });
  });

  describe('searchMovies — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedLastPage));

      const result = await service.searchMovies('batman');

      expect(result).toEqual(successResponse(expectedLastPage));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  // Two genres so the "returns the array" assertion is meaningful (order + count).
  const genres: TmdbGenre[] = [makeGenre(), makeGenre({ id: 18, name: 'Drama' })];

  describe('getGenres — cache miss', () => {
    it('calls client.get with the genre-list endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue(makeGenreListResponse({ genres }));

      await service.getGenres();

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/genre/movie/list?language=en-US');
    });

    it('returns the unwrapped genre array', async () => {
      mockTmdbClient.get.mockResolvedValue(makeGenreListResponse({ genres }));

      const result = await service.getGenres();

      expect(result).toEqual(successResponse(genres));
    });

    it('caches the genres under a fixed key with a daily TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(makeGenreListResponse({ genres }));

      await service.getGenres();

      expectCached('tmdb:genres', genres, 86_400);
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.getGenres()).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('getGenres — cache hit', () => {
    it('returns the cached genres without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(genres));

      const result = await service.getGenres();

      expect(result).toEqual(successResponse(genres));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  // Fixture defaults to id 1; the id's only role here is to prove it's
  // interpolated into the request path and cache key.
  const providers = makeWatchProviders();

  describe('getWatchProviders — cache miss', () => {
    it('calls client.get with the movie watch-providers path', async () => {
      mockTmdbClient.get.mockResolvedValue(providers);

      await service.getWatchProviders(providers.id);

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/1/watch/providers');
    });

    it('returns the providers payload as-is', async () => {
      mockTmdbClient.get.mockResolvedValue(providers);

      const result = await service.getWatchProviders(providers.id);

      expect(result).toEqual(successResponse(providers));
    });

    it('caches the payload under a per-movie key with the standard TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(providers);

      await service.getWatchProviders(providers.id);

      expectCached('tmdb:providers:movie:1', providers);
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.getWatchProviders(providers.id)).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('getWatchProviders — cache hit', () => {
    it('returns the cached payload without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(providers));

      const result = await service.getWatchProviders(providers.id);

      expect(result).toEqual(successResponse(providers));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  describe('filtered = false', () => {
    it('returns raw TMDB results without applying the filter', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeListResponse({ results: [...mockMovies, junkMovie], total_results: 2 }),
      );

      const result = await service.searchMovies('batman', 1, false);

      expect(result.data?.results).toEqual([...mockMovies, junkMovie]);
    });

    it('caches under a distinct ":raw" key so it never collides with filtered', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.fetchPopular(1, false);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:popular:page:1:raw',
        expect.any(String),
        3600,
      );
    });
  });
});
