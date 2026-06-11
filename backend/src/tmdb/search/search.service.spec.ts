import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { TmdbClient } from '../tmdb.client';
import { TmdbMovie } from '../tmdb.types';
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
      mockTmdbClient.get.mockResolvedValue([]);

      await service.searchMovies('batman');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('query=batman'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_adult=false'),
      );
      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('language=en-US'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=1'));
    });

    it('URL-encodes special characters in the query', async () => {
      mockTmdbClient.get.mockResolvedValue([]);

      await service.searchMovies('star wars');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('star+wars'));
    });

    it('returns the array resolved by client.get', async () => {
      mockTmdbClient.get.mockResolvedValue(mockMovies);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(mockMovies);
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(mockMovies);

      await service.searchMovies('batman');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:1',
        JSON.stringify(mockMovies),
        { EX: 3600 },
      );
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(mockMovies);

      await service.searchMovies('batman', 3);

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=3'));
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:search:batman:page:3',
        JSON.stringify(mockMovies),
        { EX: 3600 },
      );
    });

    it('returns an empty array when client.get resolves with []', async () => {
      mockTmdbClient.get.mockResolvedValue([]);

      const result = await service.searchMovies('unknownquery');

      expect(result).toEqual([]);
    });
  });

  describe('searchMovies — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockMovies));

      const result = await service.searchMovies('batman');

      expect(result).toEqual(mockMovies);
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });
});
