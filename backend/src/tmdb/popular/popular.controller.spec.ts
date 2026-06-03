import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovie } from '../tmdb.types';
import { PopularController } from './popular.controller';
import { PopularService } from './popular.service';

const mockPopularService = {
  fetchPopular: jest.fn(),
} satisfies Partial<jest.Mocked<PopularService>>;

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

describe('PopularController', () => {
  let controller: PopularController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PopularController],
      providers: [{ provide: PopularService, useValue: mockPopularService }],
    }).compile();
    controller = module.get<PopularController>(PopularController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('fetchPopular', () => {
    it('delegates to popularService.fetchPopular with no arguments', async () => {
      mockPopularService.fetchPopular.mockResolvedValue(mockMovies);

      await controller.fetchPopular();

      expect(mockPopularService.fetchPopular).toHaveBeenCalledWith();
    });

    it('returns the array that popularService.fetchPopular resolves with', async () => {
      mockPopularService.fetchPopular.mockResolvedValue(mockMovies);

      const result = await controller.fetchPopular();

      expect(result).toEqual(mockMovies);
    });
  });
});
