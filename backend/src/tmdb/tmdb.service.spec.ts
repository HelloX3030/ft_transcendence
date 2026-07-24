import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { TmdbClient } from './tmdb.client';
import { PaginatedMovies, TmdbGenre, TmdbMovie, TmdbPerson } from '@trailertinder/shared';
import { successResponse } from 'src/utils';
import {
  makeGenre,
  makeGenreListResponse,
  makeListResponse,
  makeMovie,
  makeMovieDetailResponse,
  makePersonResponse,
  makeWatchProviders,
} from './tmdb.fixtures';
import { TmdbService } from './tmdb.service';

const mockMovies: TmdbMovie[] = [makeMovie()];

// A movie the quality filter always rejects (no poster, zero popularity).
const junkMovie: TmdbMovie = makeMovie({ id: 99, poster_path: null, popularity: 0 });

// page 1 of 5 — more pages available, so hasMore is true.
const multiPageResponse = makeListResponse({
  results: mockMovies,
  total_pages: 5,
  total_results: 100,
});
const expectedMultiPage: PaginatedMovies = {
  results: mockMovies,
  hasMore: true,
  totalResults: 100,
};

// page 1 of 1 — no more pages, so hasMore is false.
const lastPageResponse = makeListResponse({ results: mockMovies });
const expectedLastPage: PaginatedMovies = { results: mockMovies, hasMore: false, totalResults: 1 };

const emptyResponse = makeListResponse({ results: [], page: 0, total_pages: 0, total_results: 0 });
const expectedEmpty: PaginatedMovies = { results: [], hasMore: false, totalResults: 0 };

const mockTmdbClient = {
  get: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbClient>>;

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
};

// Asserts the result was cached under `key` with the raw payload and given TTL
// (defaults to the standard 1h used by the paginated movie endpoints).
function expectCached(key: string, payload: unknown, ttl = 3600): void {
  expect(mockRedisClient.set).toHaveBeenCalledWith(key, JSON.stringify(payload), ttl);
}

describe('TmdbService', () => {
  let service: TmdbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbService,
        { provide: TmdbClient, useValue: mockTmdbClient },
        { provide: RedisService, useValue: mockRedisClient },
      ],
    }).compile();
    service = module.get<TmdbService>(TmdbService);
    jest.clearAllMocks();
    // Default to a cache miss; the cache-hit tests override get() per-test.
    mockRedisClient.get.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('discoverMovies — cache miss', () => {
    it('calls client.get with the discover endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.discoverMovies();

      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        '/discover/movie?include_adult=false&language=en-US&sort_by=popularity.desc&page=1&vote_count.gte=50&vote_average.gte=5',
      );
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      const result = await service.discoverMovies();

      expect(result).toEqual(successResponse(expectedMultiPage));
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.discoverMovies();

      expectCached(
        'tmdb:discover:include_adult=false&language=en-US&sort_by=popularity.desc&page=1&vote_count.gte=50&vote_average.gte=5:filtered',
        expectedMultiPage,
      );
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.discoverMovies();

      expect(result).toEqual(successResponse(expectedEmpty));
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.discoverMovies({ page: 4 });

      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        '/discover/movie?include_adult=false&language=en-US&sort_by=popularity.desc&page=4&vote_count.gte=50&vote_average.gte=5',
      );
      expectCached(
        'tmdb:discover:include_adult=false&language=en-US&sort_by=popularity.desc&page=4&vote_count.gte=50&vote_average.gte=5:filtered',
        expectedMultiPage,
      );
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.discoverMovies()).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('filters out movies without a poster or below the popularity threshold', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeListResponse({
          results: [...mockMovies, junkMovie],
          total_pages: 5,
          total_results: 100,
        }),
      );

      const result = await service.discoverMovies();

      expect(result.data?.results).toEqual(mockMovies);
    });
  });

  describe('discoverMovies — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedMultiPage));

      const result = await service.discoverMovies();

      expect(result).toEqual(successResponse(expectedMultiPage));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  describe('discoverMovies — filters', () => {
    it('appends with_genres, sort_by and the release-date bounds when provided', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.discoverMovies({
        sortBy: 'vote_average.desc',
        withGenres: '28,12',
        releaseDateGte: '2000-01-01',
        releaseDateLte: '2009-12-31',
      });

      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('sort_by=vote_average.desc'),
      );
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('with_genres=28%2C12'),
      );
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('primary_release_date.gte=2000-01-01'),
      );
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('primary_release_date.lte=2009-12-31'),
      );
    });

    it('maps the UI release_date sort to TMDB primary_release_date', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.discoverMovies({ sortBy: 'release_date.asc' });

      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('sort_by=primary_release_date.asc'),
      );
    });

    it('omits optional params that are not provided', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.discoverMovies({ withGenres: '28' });

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('with_genres=28'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.not.stringContaining('primary_release_date'),
      );
    });

    it('folds the filters into the cache key so combinations never collide', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      await service.discoverMovies({ withGenres: '28', sortBy: 'revenue.desc' });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('with_genres=28'),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('enforces the quality thresholds server-side when filtered', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.discoverMovies({ sortBy: 'vote_average.desc' });

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('vote_count.gte=50'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('vote_average.gte=5'),
      );
    });

    it('omits the quality thresholds when unfiltered', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.discoverMovies({ filtered: false });

      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.not.stringContaining('vote_count.gte'),
      );
    });
  });

  describe('searchMovies — cache miss', () => {
    it('calls client.get with a path containing the encoded query params', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.searchMovies('batman');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('query=batman'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        expect.stringContaining('include_adult=false'),
      );
      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('language=en-US'));
      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=1'));
    });

    it('URL-encodes special characters in the query', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      await service.searchMovies('star wars');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('star+wars'));
    });

    it('normalizes the query for both the cache key and the TMDB request', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('  Batman ');

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('query=batman'));
      expectCached('tmdb:search:batman:page:1:filtered', expectedLastPage);
    });

    it('returns the results with hasMore derived from the TMDB pagination', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(successResponse(expectedLastPage));
    });

    it('sets hasMore to true when more pages are available', async () => {
      mockTmdbClient.get.mockResolvedValue(multiPageResponse);

      const result = await service.searchMovies('batman');

      expect(result).toEqual(successResponse(expectedMultiPage));
    });

    it('stores the result in Redis with the correct key and TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman');

      expectCached('tmdb:search:batman:page:1:filtered', expectedLastPage);
    });

    it('uses the requested page in the TMDB path and cache key', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.searchMovies('batman', 3);

      expect(mockTmdbClient.get).toHaveBeenCalledWith(expect.stringContaining('page=3'));
      expectCached('tmdb:search:batman:page:3:filtered', expectedLastPage);
    });

    it('returns an empty result set when client.get resolves with no results', async () => {
      mockTmdbClient.get.mockResolvedValue(emptyResponse);

      const result = await service.searchMovies('unknownquery');

      expect(result).toEqual(successResponse(expectedEmpty));
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.searchMovies('batman')).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('filters out movies without a poster or below the popularity threshold', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeListResponse({ results: [...mockMovies, junkMovie], total_results: 2 }),
      );

      const result = await service.searchMovies('batman');

      expect(result.data?.results).toEqual(mockMovies);
    });
  });

  describe('searchMovies — cache hit', () => {
    it('returns the cached value without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedLastPage));

      const result = await service.searchMovies('batman');

      expect(result).toEqual(successResponse(expectedLastPage));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  // Two genres so the "returns the array" assertion is meaningful (order + count).
  const genres: TmdbGenre[] = [makeGenre(), makeGenre({ id: 18, name: 'Drama' })];

  describe('getGenres — cache miss', () => {
    it('calls client.get with the genre-list endpoint path', async () => {
      mockTmdbClient.get.mockResolvedValue(makeGenreListResponse({ genres }));

      await service.getGenres();

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/genre/movie/list?language=en-US');
    });

    it('returns the unwrapped genre array', async () => {
      mockTmdbClient.get.mockResolvedValue(makeGenreListResponse({ genres }));

      const result = await service.getGenres();

      expect(result).toEqual(successResponse(genres));
    });

    it('caches the genres under a fixed key with a daily TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(makeGenreListResponse({ genres }));

      await service.getGenres();

      expectCached('tmdb:genres', genres, 86_400);
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.getGenres()).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('getGenres — cache hit', () => {
    it('returns the cached genres without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(genres));

      const result = await service.getGenres();

      expect(result).toEqual(successResponse(genres));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  // Fixture defaults to id 1; the id's only role here is to prove it's
  // interpolated into the request path and cache key.
  const providers = makeWatchProviders();

  describe('getWatchProviders — cache miss', () => {
    it('calls client.get with the movie watch-providers path', async () => {
      mockTmdbClient.get.mockResolvedValue(providers);

      await service.getWatchProviders(providers.id);

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/movie/1/watch/providers');
    });

    it('returns the providers payload as-is', async () => {
      mockTmdbClient.get.mockResolvedValue(providers);

      const result = await service.getWatchProviders(providers.id);

      expect(result).toEqual(successResponse(providers));
    });

    it('caches the payload under a per-movie key with the standard TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(providers);

      await service.getWatchProviders(providers.id);

      expectCached('tmdb:providers:movie:1', providers);
    });

    it('propagates a TMDB failure without caching anything', async () => {
      mockTmdbClient.get.mockRejectedValue(new Error('TMDB request failed'));

      await expect(service.getWatchProviders(providers.id)).rejects.toThrow('TMDB request failed');
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('getWatchProviders — cache hit', () => {
    it('returns the cached payload without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(providers));

      const result = await service.getWatchProviders(providers.id);

      expect(result).toEqual(successResponse(providers));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  describe('getMovieDetail — cache miss', () => {
    it('requests the detail with credits, videos and similar appended', async () => {
      mockTmdbClient.get.mockResolvedValue(makeMovieDetailResponse());

      await service.getMovieDetail(42);

      expect(mockTmdbClient.get).toHaveBeenCalledWith(
        '/movie/42?language=en-US&append_to_response=credits,videos,similar',
      );
    });

    it('reshapes the response to TmdbMovieDetail (genres, runtime, credits, trailer)', async () => {
      mockTmdbClient.get.mockResolvedValue(makeMovieDetailResponse());

      const result = await service.getMovieDetail(1);

      expect(result.data).toMatchObject({
        id: 1,
        runtime: 140,
        tagline: 'Why so serious?',
        trailerKey: 'trailerKey1',
        genres: [{ id: 28, name: 'Action' }],
      });
      expect(result.data?.credits.crew[0]?.job).toBe('Director');
    });

    it('prefers an official YouTube trailer and falls back to a teaser, else null', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeMovieDetailResponse({
          videos: {
            results: [
              { key: 'teaser', site: 'YouTube', type: 'Teaser', official: true, name: 'Teaser' },
            ],
          },
        }),
      );

      const teaserOnly = await service.getMovieDetail(1);
      expect(teaserOnly.data?.trailerKey).toBe('teaser');

      jest.clearAllMocks();
      mockRedisClient.get.mockResolvedValue(null);
      mockTmdbClient.get.mockResolvedValue(makeMovieDetailResponse({ videos: { results: [] } }));

      const none = await service.getMovieDetail(2);
      expect(none.data?.trailerKey).toBeNull();
    });

    it('runs the similar list through the quality filter', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeMovieDetailResponse({
          similar: makeListResponse({ results: [...mockMovies, junkMovie], total_results: 2 }),
        }),
      );

      const result = await service.getMovieDetail(1);

      expect(result.data?.similar).toEqual(mockMovies);
    });

    it('tolerates a response missing the appended sections', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeMovieDetailResponse({ credits: undefined, videos: undefined, similar: undefined }),
      );

      const result = await service.getMovieDetail(1);

      expect(result.data?.credits).toEqual({ cast: [], crew: [] });
      expect(result.data?.trailerKey).toBeNull();
      expect(result.data?.similar).toEqual([]);
    });

    it('caches the reshaped detail under the movie key', async () => {
      mockTmdbClient.get.mockResolvedValue(makeMovieDetailResponse());

      await service.getMovieDetail(7);

      expect(mockRedisClient.set).toHaveBeenCalledWith('tmdb:movie:7', expect.any(String), 3600);
    });
  });

  describe('getMovieDetail — cache hit', () => {
    it('returns the cached detail without calling client.get', async () => {
      const cached = { id: 1, title: 'Cached', trailerKey: null, similar: [] };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getMovieDetail(1);

      expect(result.data).toEqual(cached);
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });
  });

  // The public projection of makePersonResponse() — biography/birthday/popularity
  // are dropped by the service.
  const expectedPerson: TmdbPerson = {
    id: 287,
    name: 'Brad Pitt',
    profile_path: '/bp.jpg',
    known_for_department: 'Acting',
  };

  // Resolves each /person/{id} request to a distinct person, so per-id behaviour
  // (ordering, dedup, caching) is observable.
  function mockPeopleByPath(): void {
    mockTmdbClient.get.mockImplementation((path: string) => {
      const id = Number(/\/person\/(\d+)/.exec(path)?.[1]);
      return Promise.resolve(makePersonResponse({ id, name: `Person ${id}` }));
    });
  }

  describe('getPeople — cache miss', () => {
    it('calls client.get with the person endpoint path for each id', async () => {
      mockPeopleByPath();

      await service.getPeople([287, 500]);

      expect(mockTmdbClient.get).toHaveBeenCalledWith('/person/287?language=en-US');
      expect(mockTmdbClient.get).toHaveBeenCalledWith('/person/500?language=en-US');
    });

    it('reshapes each response to TmdbPerson, dropping the extra TMDB fields', async () => {
      mockTmdbClient.get.mockResolvedValue(makePersonResponse());

      const result = await service.getPeople([287]);

      expect(result).toEqual(successResponse([expectedPerson]));
    });

    it('caches each person under its own key with the weekly TTL', async () => {
      mockTmdbClient.get.mockResolvedValue(makePersonResponse());

      await service.getPeople([287]);

      expectCached('tmdb:person:287', expectedPerson, 604_800);
    });

    it('de-duplicates repeated ids into a single upstream call', async () => {
      mockPeopleByPath();

      const result = await service.getPeople([287, 287, 287]);

      expect(mockTmdbClient.get).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
    });

    it('skips ids TMDB reports as unknown and returns the rest', async () => {
      mockTmdbClient.get.mockImplementation((path: string) =>
        path.includes('/person/999')
          ? Promise.reject(new NotFoundException('TMDB resource not found'))
          : Promise.resolve(makePersonResponse()),
      );
      jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});

      const result = await service.getPeople([287, 999]);

      expect(result).toEqual(successResponse([expectedPerson]));
    });

    it('propagates an upstream outage instead of masking it as an empty list', async () => {
      mockTmdbClient.get.mockRejectedValue(new BadGatewayException('TMDB is unreachable'));

      await expect(service.getPeople([287, 500])).rejects.toThrow(BadGatewayException);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('bounds how many person requests are in flight at once', async () => {
      let inFlight = 0;
      let peakInFlight = 0;
      mockTmdbClient.get.mockImplementation(async (path: string) => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight--;
        return makePersonResponse({ id: Number(/\/person\/(\d+)/.exec(path)?.[1]) });
      });
      const ids = Array.from({ length: 50 }, (_, index) => index + 1);

      await service.getPeople(ids);

      expect(mockTmdbClient.get).toHaveBeenCalledTimes(50);
      expect(peakInFlight).toBeLessThanOrEqual(5);
    });

    it('collapses concurrent misses for the same person into one upstream call', async () => {
      mockPeopleByPath();

      const [first, second] = await Promise.all([
        service.getPeople([287]),
        service.getPeople([287]),
      ]);

      expect(mockTmdbClient.get).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);

      // The in-flight entry is released once settled, so a later miss refetches.
      await service.getPeople([287]);
      expect(mockTmdbClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPeople — cache hit', () => {
    it('returns the cached person without calling client.get', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedPerson));

      const result = await service.getPeople([287]);

      expect(result).toEqual(successResponse([expectedPerson]));
      expect(mockTmdbClient.get).not.toHaveBeenCalled();
    });

    it('fetches only the ids that missed the cache', async () => {
      mockRedisClient.get.mockImplementation((key: string) =>
        Promise.resolve(key === 'tmdb:person:287' ? JSON.stringify(expectedPerson) : null),
      );
      mockPeopleByPath();

      const result = await service.getPeople([287, 500]);

      expect(mockTmdbClient.get).toHaveBeenCalledTimes(1);
      expect(mockTmdbClient.get).toHaveBeenCalledWith('/person/500?language=en-US');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('filtered = false', () => {
    it('returns raw TMDB results without applying the filter', async () => {
      mockTmdbClient.get.mockResolvedValue(
        makeListResponse({ results: [...mockMovies, junkMovie], total_results: 2 }),
      );

      const result = await service.searchMovies('batman', 1, false);

      expect(result.data?.results).toEqual([...mockMovies, junkMovie]);
    });

    it('caches under a distinct ":raw" key so it never collides with filtered', async () => {
      mockTmdbClient.get.mockResolvedValue(lastPageResponse);

      await service.discoverMovies({ page: 1, filtered: false });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'tmdb:discover:include_adult=false&language=en-US&sort_by=popularity.desc&page=1:raw',
        expect.any(String),
        3600,
      );
    });
  });
});
