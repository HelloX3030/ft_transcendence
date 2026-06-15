import { Test, TestingModule } from '@nestjs/testing';
import { SearchQueryDto } from './dto/search-query.dto';
import { makeMovie } from './tmdb.fixtures';
import { PaginatedMovies, TmdbMovie } from './tmdb.types';
import { TmdbController } from './tmdb.controller';
import { TmdbService } from './tmdb.service';

const mockTmdbService = {
  fetchPopular: jest.fn(),
  searchMovies: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbService>>;

const mockMovies: TmdbMovie[] = [makeMovie()];

const mockPage: PaginatedMovies = { results: mockMovies, hasMore: false };

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
      mockTmdbService.fetchPopular.mockResolvedValue(mockPage);

      await controller.fetchPopular({ page: 1, filtered: true });

      expect(mockTmdbService.fetchPopular).toHaveBeenCalledWith(1, true);
    });

    it('forwards the requested page to tmdbService.fetchPopular', async () => {
      mockTmdbService.fetchPopular.mockResolvedValue(mockPage);

      await controller.fetchPopular({ page: 4, filtered: true });

      expect(mockTmdbService.fetchPopular).toHaveBeenCalledWith(4, true);
    });

    it('returns the paginated result that tmdbService.fetchPopular resolves with', async () => {
      mockTmdbService.fetchPopular.mockResolvedValue(mockPage);

      const result = await controller.fetchPopular({ page: 1, filtered: true });

      expect(result).toEqual(mockPage);
    });
  });

  describe('searchMovies', () => {
    it('delegates to tmdbService.searchMovies with dto.query and dto.page', async () => {
      mockTmdbService.searchMovies.mockResolvedValue(mockPage);
      const dto: SearchQueryDto = { query: 'batman', page: 1, filtered: true };

      await controller.searchMovies(dto);

      expect(mockTmdbService.searchMovies).toHaveBeenCalledWith('batman', 1, true);
    });

    it('forwards the requested page to tmdbService.searchMovies', async () => {
      mockTmdbService.searchMovies.mockResolvedValue(mockPage);
      const dto: SearchQueryDto = { query: 'batman', page: 3, filtered: true };

      await controller.searchMovies(dto);

      expect(mockTmdbService.searchMovies).toHaveBeenCalledWith('batman', 3, true);
    });

    it('returns the paginated result that tmdbService.searchMovies resolves with', async () => {
      mockTmdbService.searchMovies.mockResolvedValue(mockPage);
      const dto: SearchQueryDto = { query: 'batman', page: 1, filtered: true };

      const result = await controller.searchMovies(dto);

      expect(result).toEqual(mockPage);
    });
  });
});
