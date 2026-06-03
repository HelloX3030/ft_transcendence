import { Test, TestingModule } from '@nestjs/testing';
import { TmdbClient } from '../tmdb.client';
import { TmdbMovie } from '../tmdb.types';
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

const mockTmdbClient = {
  get: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbClient>>;

describe('PopularService', () => {
  let service: PopularService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PopularService, { provide: TmdbClient, useValue: mockTmdbClient }],
    }).compile();
    service = module.get<PopularService>(PopularService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchPopular', () => {
    it('calls client.get with the popular endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue([]);

      await service.fetchPopular();

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/popular?language=en-US&page=1');
    });

    it('returns the array resolved by client.get', async () => {
      mockTmdbClient.get.mockResolvedValue(mockMovies);

      const result = await service.fetchPopular();

      expect(result).toEqual(mockMovies);
    });

    it('returns an empty array when client.get resolves with []', async () => {
      mockTmdbClient.get.mockResolvedValue([]);

      const result = await service.fetchPopular();

      expect(result).toEqual([]);
    });
  });
});
