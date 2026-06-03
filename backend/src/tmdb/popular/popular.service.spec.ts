import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovie } from '../tmdb.types';
import { PopularService } from './popular.service';

process.env.TMDB_API_KEY = 'test-api-key';

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

function mockFetchWith(body: unknown, ok = true): void {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('PopularService', () => {
  let service: PopularService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PopularService],
    }).compile();
    service = module.get<PopularService>(PopularService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.TMDB_API_KEY = 'test-api-key';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchPopular', () => {
    it('returns the results array from the TMDB response', async () => {
      mockFetchWith({ results: mockMovies, page: 1, total_pages: 1, total_results: 1 });

      const result = await service.fetchPopular();

      expect(result).toEqual(mockMovies);
    });

    it('calls fetch with the correct popular endpoint URL', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await service.fetchPopular();

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1',
        expect.anything(),
      );
    });

    it('calls fetch with the Authorization Bearer header', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await service.fetchPopular();

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(expect.anything(), {
        headers: { accept: 'application/json', Authorization: 'Bearer test-api-key' },
      });
    });

    it('returns an empty array when results is empty', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      const result = await service.fetchPopular();

      expect(result).toEqual([]);
    });

    it('returns [] when TMDB_API_KEY is not set', async () => {
      delete process.env.TMDB_API_KEY;

      const result = await service.fetchPopular();

      expect(result).toEqual([]);
    });

    it('returns [] when the TMDB response is not ok', async () => {
      mockFetchWith({}, false);

      const result = await service.fetchPopular();

      expect(result).toEqual([]);
    });
  });
});
