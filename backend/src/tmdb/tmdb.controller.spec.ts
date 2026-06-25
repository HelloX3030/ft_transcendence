import { Test, TestingModule } from '@nestjs/testing';
import { SearchQueryDto } from './dto/search-query.dto';
import { PaginatedMovies, TmdbGenre, TmdbMovie } from '@trailertinder/shared';
import { successResponse } from 'src/utils';
import { makeGenre, makeMovie, makeWatchProviders } from './tmdb.fixtures';
import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';

const mockTmdbService = {
  fetchPopular: jest.fn(),
  searchMovies: jest.fn(),
  getGenres: jest.fn(),
  getWatchProviders: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbService>>;

const mockMovies: TmdbMovie[] = [makeMovie()];

const mockPage: PaginatedMovies = { results: mockMovies, hasMore: false, totalResults: 1 };
const mockResponse = successResponse(mockPage);

describe('TmdbController', () => {
  let controller: TmdbController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TmdbController],
      providers: [{ provide: TmdbService, useValue: mockTmdbService }],
    }).compile();
    controller = module.get<TmdbController>(TmdbController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('fetchPopular', () => {
    it('delegates to tmdbService.fetchPopular with dto.page', async () => {
      mockTmdbService.fetchPopular.mockResolvedValue(mockResponse);

      await controller.fetchPopular({ page: 1, filtered: true });

      expect(mockTmdbService.fetchPopular).toHaveBeenCalledWith(1, true);
    });

    it('forwards the requested page to tmdbService.fetchPopular', async () => {
      mockTmdbService.fetchPopular.mockResolvedValue(mockResponse);

      await controller.fetchPopular({ page: 4, filtered: true });

      expect(mockTmdbService.fetchPopular).toHaveBeenCalledWith(4, true);
    });

    it('returns the paginated result that tmdbService.fetchPopular resolves with', async () => {
      mockTmdbService.fetchPopular.mockResolvedValue(mockResponse);

      const result = await controller.fetchPopular({ page: 1, filtered: true });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('searchMovies', () => {
    it('delegates to tmdbService.searchMovies with dto.query and dto.page', async () => {
      mockTmdbService.searchMovies.mockResolvedValue(mockResponse);
      const dto: SearchQueryDto = { query: 'batman', page: 1, filtered: true };

      await controller.searchMovies(dto);

      expect(mockTmdbService.searchMovies).toHaveBeenCalledWith('batman', 1, true);
    });

    it('forwards the requested page to tmdbService.searchMovies', async () => {
      mockTmdbService.searchMovies.mockResolvedValue(mockResponse);
      const dto: SearchQueryDto = { query: 'batman', page: 3, filtered: true };

      await controller.searchMovies(dto);

      expect(mockTmdbService.searchMovies).toHaveBeenCalledWith('batman', 3, true);
    });

    it('returns the paginated result that tmdbService.searchMovies resolves with', async () => {
      mockTmdbService.searchMovies.mockResolvedValue(mockResponse);
      const dto: SearchQueryDto = { query: 'batman', page: 1, filtered: true };

      const result = await controller.searchMovies(dto);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getGenres', () => {
    const mockGenres: TmdbGenre[] = [makeGenre()];
    const mockGenresResponse = successResponse(mockGenres);

    it('delegates to tmdbService.getGenres', async () => {
      mockTmdbService.getGenres.mockResolvedValue(mockGenresResponse);

      await controller.getGenres();

      expect(mockTmdbService.getGenres).toHaveBeenCalled();
    });

    it('returns the genre list that tmdbService.getGenres resolves with', async () => {
      mockTmdbService.getGenres.mockResolvedValue(mockGenresResponse);

      const result = await controller.getGenres();

      expect(result).toEqual(mockGenresResponse);
    });
  });

  describe('getWatchProviders', () => {
    const mockProviders = makeWatchProviders();
    const mockProvidersResponse = successResponse(mockProviders);

    it('delegates to tmdbService.getWatchProviders with the movie id', async () => {
      mockTmdbService.getWatchProviders.mockResolvedValue(mockProvidersResponse);

      await controller.getWatchProviders(mockProviders.id);

      expect(mockTmdbService.getWatchProviders).toHaveBeenCalledWith(mockProviders.id);
    });

    it('returns the providers that tmdbService.getWatchProviders resolves with', async () => {
      mockTmdbService.getWatchProviders.mockResolvedValue(mockProvidersResponse);

      const result = await controller.getWatchProviders(mockProviders.id);

      expect(result).toEqual(mockProvidersResponse);
    });
  });
});
