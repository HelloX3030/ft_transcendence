import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovie } from '../tmdb.types';
import { SearchService } from './search.service';

process.env.TMDB_API_KEY = 'test-api-key';

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

function mockFetchWith(body: unknown, ok = true): void {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService],
    }).compile();
    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.TMDB_API_KEY = 'test-api-key';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchMovies', () => {
    it('returns the results array from the TMDB response', async () => {
      mockFetchWith({ results: mockMovies, page: 1, total_pages: 1, total_results: 1 });

      const result = await service.searchMovies('batman');

      expect(result).toEqual(mockMovies);
    });

    it('calls fetch with the correct URL including the encoded query params', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await service.searchMovies('batman');

      const fetchMock = jest.mocked(global.fetch);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('query=batman'),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('include_adult=false'),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('language=en-US'),
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.anything());
    });

    it('calls fetch with the Authorization Bearer header', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await service.searchMovies('batman');

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(expect.anything(), {
        headers: { accept: 'application/json', Authorization: 'Bearer test-api-key' },
      });
    });

    it('returns an empty array when results is empty', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      const result = await service.searchMovies('unknownquery');

      expect(result).toEqual([]);
    });

    it('URL-encodes special characters in the query string', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await service.searchMovies('star wars');

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining('star+wars'),
        expect.anything(),
      );
    });

    it('returns [] when TMDB_API_KEY is not set', async () => {
      delete process.env.TMDB_API_KEY;

      const result = await service.searchMovies('batman');

      expect(result).toEqual([]);
    });

    it('returns [] when the TMDB response is not ok', async () => {
      mockFetchWith({}, false);

      const result = await service.searchMovies('batman');

      expect(result).toEqual([]);
    });
  });
});
