import { MetricsService } from 'src/metrics/metrics.service';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovie } from '@cinemates/shared';
import { makeMovie } from './tmdb.fixtures';
import { TmdbClient } from './tmdb.client';

process.env.TMDB_API_KEY = 'test-api-key';
process.env.TMDB_RATE_LIMIT = '20';
process.env.TMDB_RATE_WINDOW_SECONDS = '1';

const mockMovies: TmdbMovie[] = [makeMovie()];

function mockFetchWith(body: unknown, ok = true, status = ok ? 200 : 500): void {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

describe('TmdbClient', () => {
  let client: TmdbClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TmdbClient, MetricsService],
    }).compile();
    client = module.get<TmdbClient>(TmdbClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  // The ceiling has to come from the environment, or turning it down during an
  // incident would need a rebuild. Read through the derived interval, since that
  // is what actually paces the requests: 1000ms / 20 requests.
  it('builds its budget from TMDB_RATE_LIMIT and TMDB_RATE_WINDOW_SECONDS', () => {
    const budget = client['budget'];

    expect(budget['emissionIntervalMs']).toBe(50);
    expect(budget['burstToleranceMs']).toBe(19 * 50);
  });

  describe('get', () => {
    it('returns the full list response on a successful response', async () => {
      const body = { results: mockMovies, page: 1, total_pages: 1, total_results: 1 };
      mockFetchWith(body);

      const result = await client.get('/movie/popular?language=en-US&page=1');

      expect(result).toEqual(body);
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

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: { accept: 'application/json', Authorization: 'Bearer test-api-key' },
        }),
      );
    });

    it('calls fetch with a timeout signal so hung connections abort', async () => {
      mockFetchWith({ results: [], page: 1, total_pages: 0, total_results: 0 });

      await client.get('/movie/popular?language=en-US&page=1');

      expect(jest.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: expect.any(AbortSignal) as AbortSignal }),
      );
    });

    it('throws BadGatewayException and logs a warning when the response is not ok', async () => {
      mockFetchWith({}, false);
      const warnSpy = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      await expect(client.get('/movie/popular?language=en-US&page=1')).rejects.toThrow(
        BadGatewayException,
      );
      expect(warnSpy).toHaveBeenCalled();
    });

    it('throws NotFoundException when the resource does not exist upstream', async () => {
      mockFetchWith({}, false, 404);
      const warnSpy = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      await expect(client.get('/person/999999?language=en-US')).rejects.toThrow(NotFoundException);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('keeps a 5xx as BadGatewayException so an outage is distinguishable from a 404', async () => {
      mockFetchWith({}, false, 503);
      jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      await expect(client.get('/person/287?language=en-US')).rejects.toThrow(BadGatewayException);
      await expect(client.get('/person/287?language=en-US')).rejects.not.toThrow(NotFoundException);
    });

    it('throws BadGatewayException and logs a warning when fetch throws a network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'));
      const warnSpy = jest.spyOn(client['logger'], 'warn').mockImplementation(() => {});

      await expect(client.get('/movie/popular?language=en-US&page=1')).rejects.toThrow(
        BadGatewayException,
      );
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
