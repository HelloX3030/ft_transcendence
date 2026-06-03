import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovie } from './tmdb.types';
import { TmdbClient } from './tmdb.client';

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
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('TmdbClient', () => {
  let client: TmdbClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TmdbClient],
    }).compile();
    client = module.get<TmdbClient>(TmdbClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('get', () => {
    it('returns the results array on a successful response', async () => {
      mockFetchWith({ results: mockMovies, page: 1, total_pages: 1, total_results: 1 });

      const result = await client.get('/movie/popular?language=en-US&page=1');

      expect(result).toEqual(mockMovies);
    });

    it('calls fetch with the correct full URL', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await client.get('/movie/popular?language=en-US&page=1');

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1',
        expect.anything(),
      );
    });

    it('calls fetch with the Authorization Bearer header', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await client.get('/movie/popular?language=en-US&page=1');

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(expect.anything(), {
        headers: { accept: 'application/json', Authorization: 'Bearer test-api-key' },
      });
    });

    it('returns [] and logs a warning when the response is not ok', async () => {
      mockFetchWith({}, false);
      const warnSpy = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      const result = await client.get('/movie/popular?language=en-US&page=1');

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns [] and logs a warning when fetch throws a network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'));
      const warnSpy = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      const result = await client.get('/movie/popular?language=en-US&page=1');

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
