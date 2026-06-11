import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { TmdbClient } from '../tmdb.client';
import { PaginatedMovies, TmdbListResponse, TmdbMovie } from '../tmdb.types';
import { SearchService } from './search.service';

const mockMovies: TmdbMovie[] = [
  {
    id: 1,
    title: 'Batman Begins',
    original_title: 'Batman Begins',
    overview: 'A superhero film',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    release_date: '2005-06-15',
    vote_average: 8.2,
    vote_count: 12000,
    popularity: 50.5,
    genre_ids: [28, 18],
    original_language: 'en',
    adult: false,
    video: false,
  },
];

// Single page of results — page 1 of 1, so hasMore is false.
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

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: TmdbClient, useValue: mockTmdbClient },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();
    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchMovies — cache miss', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
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

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(expectedLastPage);
    });

    it('sets hasMore to true when more pages are available', async () => {
      mockTmdbClient.get.mockResolvedValue({
        results: mockMovies,
        page: 1,
        total_pages: 5,
        total_results: 100,
      });

      const result = await service.searchMovies('batman');

      expect(result).toEqual({ results: mockMovies, hasMore: true });
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:1',
        JSON.stringify(expectedLastPage),
        { EX: 3600 },
      );
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman', 3);

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=3'));
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:3',
        JSON.stringify(expectedLastPage),
        { EX: 3600 },
      );
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.searchMovies('unknownquery');

      expect(result).toEqual({ results: [], hasMore: false });
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
});
