import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { TmdbClient } from '../tmdb.client';
import { PaginatedMovies, TmdbListResponse, TmdbMovie } from '../tmdb.types';
import { PopularService } from './popular.service';

const mockMovies: TmdbMovie[] = [
  {
    id: 2,
    title: 'The Dark Knight',
    original_title: 'The Dark Knight',
    overview: 'Batman faces the Joker',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    release_date: '2008-07-18',
    vote_average: 9.0,
    vote_count: 25000,
    popularity: 100.0,
    genre_ids: [28, 80, 18],
    original_language: 'en',
    adult: false,
    video: false,
  },
];

// page 1 of 5 — more pages available, so hasMore is true.
const popularResponse: TmdbListResponse = {
  results: mockMovies,
  page: 1,
  total_pages: 5,
  total_results: 100,
};
const expectedPopular: PaginatedMovies = { results: mockMovies, hasMore: true };

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

describe('PopularService', () => {
  let service: PopularService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PopularService,
        { provide: TmdbClient, useValue: mockTmdbClient },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();
    service = module.get<PopularService>(PopularService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchPopular — cache miss', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
    });

    it('calls client.get with the popular endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.fetchPopular();

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=1');
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(popularResponse);

      const result = await service.fetchPopular();

      expect(result).toEqual(expectedPopular);
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(popularResponse);

      await service.fetchPopular();

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:popular:page:1',
        JSON.stringify(expectedPopular),
        { EX: 3600 },
      );
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.fetchPopular();

      expect(result).toEqual({ results: [], hasMore: false });
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(popularResponse);

      await service.fetchPopular(4);

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=4');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:popular:page:4',
        JSON.stringify(expectedPopular),
        { EX: 3600 },
      );
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
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedPopular));

      const result = await service.fetchPopular();

      expect(result).toEqual(expectedPopular);
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });
});
