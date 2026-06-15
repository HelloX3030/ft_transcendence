import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { TmdbClient } from './tmdb.client';
import { makeMovie } from './tmdb.fixtures';
import { PaginatedMovies, TmdbListResponse, TmdbMovie } from './tmdb.types';
import { TmdbService } from './tmdb.service';

const mockMovies: TmdbMovie[] = [makeMovie()];

// page 1 of 5 — more pages available, so hasMore is true.
const multiPageResponse: TmdbListResponse = {
  results: mockMovies,
  page: 1,
  total_pages: 5,
  total_results: 100,
};
const expectedMultiPage: PaginatedMovies = { results: mockMovies, hasMore: true };

// page 1 of 1 — no more pages, so hasMore is false.
const lastPageResponse: TmdbListResponse = {
  results: mockMovies,
  page: 1,
  total_pages: 1,
  total_results: 1,
};
const expectedLastPage: PaginatedMovies = { results: mockMovies, hasMore: false };

const emptyResponse: TmdbListResponse = {
  results: [],
  page: 0,
  total_pages: 0,
  total_results: 0,
};

const mockTmdbClient = {
  get: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbClient>>;

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
};

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchPopular — cache miss', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue(undefined);
    });

    it('calls client.get with the popular endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.fetchPopular();

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=1');
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      const result = await service.fetchPopular();

      expect(result).toEqual(expectedMultiPage);
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.fetchPopular();

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:popular:page:1:filtered',
        JSON.stringify(expectedMultiPage),
        3600,
      );
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.fetchPopular();

      expect(result).toEqual({ results: [], hasMore: false });
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.fetchPopular(4);

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=4');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:popular:page:4:filtered',
        JSON.stringify(expectedMultiPage),
        3600,
      );
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.fetchPopular()).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('filters out movies without a poster or below the popularity threshold', async () => {
      const junk: TmdbMovie = { ...mockMovies[0], id: 99, poster_path: null, popularity: 0 };
      mockTmdbClient.get.mockResolvedValue({
        results: [...mockMovies, junk],
        page: 1,
        total_pages: 5,
        total_results: 100,
      });

      const result = await service.fetchPopular();

      expect(result.results).toEqual(mockMovies);
    });
  });

  describe('fetchPopular — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedMultiPage));

      const result = await service.fetchPopular();

      expect(result).toEqual(expectedMultiPage);
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  describe('searchMovies — cache miss', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue(undefined);
    });

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
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:1:filtered',
        JSON.stringify(expectedLastPage),
        3600,
      );
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(expectedLastPage);
    });

    it('sets hasMore to true when more pages are available', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(expectedMultiPage);
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:1:filtered',
        JSON.stringify(expectedLastPage),
        3600,
      );
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman', 3);

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=3'));
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:3:filtered',
        JSON.stringify(expectedLastPage),
        3600,
      );
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.searchMovies('unknownquery');

      expect(result).toEqual({ results: [], hasMore: false });
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.searchMovies('batman')).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('filters out movies without a poster or below the popularity threshold', async () => {
      const junk: TmdbMovie = { ...mockMovies[0], id: 99, poster_path: null, popularity: 0 };
      mockTmdbClient.get.mockResolvedValue({
        results: [...mockMovies, junk],
        page: 1,
        total_pages: 1,
        total_results: 2,
      });

      const result = await service.searchMovies('batman');

      expect(result.results).toEqual(mockMovies);
    });
  });

  describe('searchMovies — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedLastPage));

      const result = await service.searchMovies('batman');

      expect(result).toEqual(expectedLastPage);
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  describe('filtered = false', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue(undefined);
    });

    it('returns raw TMDB results without applying the filter', async () => {
      const junk: TmdbMovie = { ...mockMovies[0], id: 99, poster_path: null, popularity: 0 };
      mockTmdbClient.get.mockResolvedValue({
        results: [...mockMovies, junk],
        page: 1,
        total_pages: 1,
        total_results: 2,
      });

      const result = await service.searchMovies('batman', 1, false);

      expect(result.results).toEqual([...mockMovies, junk]);
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
