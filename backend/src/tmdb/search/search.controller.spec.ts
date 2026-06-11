import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovie } from '../tmdb.types';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

const mockSearchService = {
  searchMovies: jest.fn(),
} satisfies Partial<jest.Mocked<SearchService>>;

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

describe('SearchController', () => {
  let controller: SearchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockSearchService }],
    }).compile();
    controller = module.get<SearchController>(SearchController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchMovies', () => {
    it('delegates to searchService.searchMovies with dto.query and dto.page', async () => {
      mockSearchService.searchMovies.mockResolvedValue(mockMovies);
      const dto: SearchQueryDto = { query: 'batman', page: 1 };

      await controller.searchMovies(dto);

      expect(mockSearchService.searchMovies).toHaveBeenCalledWith('batman', 1);
    });

    it('forwards the requested page to searchService.searchMovies', async () => {
      mockSearchService.searchMovies.mockResolvedValue(mockMovies);
      const dto: SearchQueryDto = { query: 'batman', page: 3 };

      await controller.searchMovies(dto);

      expect(mockSearchService.searchMovies).toHaveBeenCalledWith('batman', 3);
    });

    it('returns the array that searchService.searchMovies resolves with', async () => {
      mockSearchService.searchMovies.mockResolvedValue(mockMovies);
      const dto: SearchQueryDto = { query: 'batman', page: 1 };

      const result = await controller.searchMovies(dto);

      expect(result).toEqual(mockMovies);
    });
  });
});
