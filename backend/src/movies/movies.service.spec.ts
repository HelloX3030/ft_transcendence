import { BadGatewayException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TmdbMovieDetail } from '@cinemates/shared';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { RecommenderClient } from 'src/recommender/recommender.client';
import { TmdbService } from 'src/tmdb/tmdb.service';
import { MovieUtils } from 'src/utils/movie.utils';
import {
  FEED_EMPTY_NONE_PLAYABLE,
  FEED_EMPTY_NO_CANDIDATES,
  MoviesService,
} from './movies.service';

const mockMovie = { id: 42, tmdbId: 640146, name: 'Quantumania', posterPath: '/poster.jpg' };

// PrismaService inherits a large generated client; only type the slice this service uses.
const mockPrisma = {
  ratings: {
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
} satisfies { ratings: Partial<jest.Mocked<PrismaService['ratings']>> };

const mockMovieUtils = {
  ensureMovie: jest.fn(),
} satisfies Partial<jest.Mocked<MovieUtils>>;

const mockRecommender = {
  feed: jest.fn(),
  signal: jest.fn(),
} satisfies Partial<jest.Mocked<RecommenderClient>>;

const mockTmdb = {
  getMovieDetail: jest.fn(),
} satisfies Partial<jest.Mocked<TmdbService>>;

function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', { code, clientVersion: '5.0.0' });
}

function detail(id: number, trailerKey: string | null): { data: TmdbMovieDetail } {
  return {
    data: {
      id,
      title: `Movie ${id}`,
      original_title: `Movie ${id}`,
      overview: 'overview',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      release_date: '2024-01-01',
      vote_average: 7.5,
      vote_count: 100,
      popularity: 12,
      original_language: 'en',
      adult: false,
      video: false,
      genres: [{ id: 28, name: 'Action' }],
      runtime: 120,
      tagline: '',
      credits: { cast: [], crew: [] },
      trailerKey,
      similar: [],
    },
  };
}

/** Every id resolves to a playable card unless listed in `unplayable`. */
function respondWithDetails(unplayable: number[] = []) {
  mockTmdb.getMovieDetail.mockImplementation((id: number) =>
    Promise.resolve(detail(id, unplayable.includes(id) ? null : `key-${id}`)),
  );
}

describe('MoviesService', () => {
  let service: MoviesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MovieUtils, useValue: mockMovieUtils },
        { provide: RecommenderClient, useValue: mockRecommender },
        { provide: TmdbService, useValue: mockTmdb },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
    jest.clearAllMocks();
    mockMovieUtils.ensureMovie.mockResolvedValue(mockMovie);
    mockPrisma.ratings.create.mockResolvedValue(undefined);
  });

  describe('setReaction', () => {
    it('resolves the movie and writes the reaction', async () => {
      const result = await service.setReaction(640146, 'like', 7);

      expect(mockMovieUtils.ensureMovie).toHaveBeenCalledWith(640146);
      expect(mockPrisma.ratings.create).toHaveBeenCalledWith({
        data: { userId: 7, movieId: 42, trailerRating: 'like' },
      });
      expect(result.data).toEqual({ tmdbId: 640146, reaction: 'like' });
    });

    // The composite PK (user_id, movie_id) is what makes a reaction permanent;
    // this is the path that turns that guarantee into a status the client reads.
    it('turns the unique-constraint violation into a conflict', async () => {
      mockPrisma.ratings.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.setReaction(640146, 'dislike', 7)).rejects.toThrow(ConflictException);
      expect(mockPrisma.ratings.create).toHaveBeenCalledTimes(1);
    });

    it('rethrows any other prisma failure untouched', async () => {
      const failure = prismaError('P2003');
      mockPrisma.ratings.create.mockRejectedValue(failure);

      await expect(service.setReaction(640146, 'like', 7)).rejects.toBe(failure);
    });

    // A reaction is written once and never replaced. Asserted on the mock rather
    // than by reading the source, so an added overwrite path fails the suite.
    it('never updates, upserts or deletes a rating', async () => {
      await service.setReaction(640146, 'like', 7);
      mockPrisma.ratings.create.mockRejectedValue(prismaError('P2002'));
      await expect(service.setReaction(640146, 'dislike', 7)).rejects.toThrow(ConflictException);

      expect(mockPrisma.ratings.update).not.toHaveBeenCalled();
      expect(mockPrisma.ratings.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.ratings.delete).not.toHaveBeenCalled();
    });

    // The TMDB id, not movies.id — the recommender keys its metadata on TMDB's,
    // so the internal id would silently train the profile on the wrong films.
    it('signals the recommender once, with the TMDB id', async () => {
      await service.setReaction(640146, 'like', 7);

      expect(mockRecommender.signal).toHaveBeenCalledTimes(1);
      expect(mockRecommender.signal).toHaveBeenCalledWith(7, 640146, 'like');
    });

    // Signals accumulate into the taste profile, so re-sending one would double
    // a preference the user expressed once.
    it('sends no signal when the reaction already existed', async () => {
      mockPrisma.ratings.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.setReaction(640146, 'like', 7)).rejects.toThrow(ConflictException);
      expect(mockRecommender.signal).not.toHaveBeenCalled();
    });

    // Fire-and-forget: the response must not wait on a second service, so a
    // recommender that is down or slow cannot turn a recorded reaction into a
    // failed — or merely sluggish — request.
    it('does not wait on the signal', async () => {
      let settled = false;
      mockRecommender.signal.mockImplementation(() => {
        // Mirrors the real client: returns void, and its request — here a slow
        // one, as an unreachable recommender would be — settles later.
        void new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
          settled = true;
        });
      });

      await expect(service.setReaction(640146, 'like', 7)).resolves.toBeDefined();
      expect(settled).toBe(false);
    });
  });

  describe('getFeed', () => {
    it('asks the recommender for exactly the requested limit', async () => {
      mockRecommender.feed.mockResolvedValue([1, 2, 3]);
      respondWithDetails();

      await service.getFeed(7, 3);

      expect(mockRecommender.feed).toHaveBeenCalledTimes(1);
      expect(mockRecommender.feed).toHaveBeenCalledWith(7, 3);
    });

    it('says so when the recommender had nothing to offer', async () => {
      mockRecommender.feed.mockResolvedValue([]);
      respondWithDetails();

      const result = await service.getFeed(7, 2);

      expect(result.data).toEqual([]);
      expect(result.message).toBe(FEED_EMPTY_NO_CANDIDATES);
    });

    it('says so when everything recommended turned out to be unplayable', async () => {
      mockRecommender.feed.mockResolvedValue([1, 2]);
      // Both known to TMDB, neither with a trailer.
      respondWithDetails([1, 2]);

      const result = await service.getFeed(7, 2);

      expect(result.data).toEqual([]);
      expect(result.message).toBe(FEED_EMPTY_NONE_PLAYABLE);
    });

    it('returns playable cards in the recommender order', async () => {
      mockRecommender.feed.mockResolvedValue([9, 4]);
      respondWithDetails();

      const result = await service.getFeed(7, 2);

      expect(result.data?.map((card) => card.tmdbId)).toEqual([9, 4]);
      expect(result.data?.[0]).toMatchObject({
        title: 'Movie 9',
        trailerKey: 'key-9',
        genreIds: [28],
        posterPath: '/poster.jpg',
      });
    });

    it('drops movies that have no trailer', async () => {
      mockRecommender.feed.mockResolvedValue([1, 2, 3]);
      respondWithDetails([2]);

      const result = await service.getFeed(7, 3);

      expect(result.data?.map((card) => card.tmdbId)).toEqual([1, 3]);
      expect(result.data?.every((card) => card.trailerKey !== null)).toBe(true);
    });

    it('drops a movie TMDB no longer knows about', async () => {
      mockRecommender.feed.mockResolvedValue([1, 2]);
      mockTmdb.getMovieDetail.mockImplementation((id: number) =>
        id === 2
          ? Promise.reject(new NotFoundException('TMDB resource not found'))
          : Promise.resolve(detail(id, `key-${id}`)),
      );

      const result = await service.getFeed(7, 2);

      expect(result.data?.map((card) => card.tmdbId)).toEqual([1]);
    });

    // One dead id is data; an unreachable TMDB is an outage. Swallowing both
    // would turn a total failure into a successful empty feed.
    it('propagates a TMDB outage instead of returning a short page', async () => {
      mockRecommender.feed.mockResolvedValue([1, 2]);
      mockTmdb.getMovieDetail.mockRejectedValue(new BadGatewayException('TMDB is unreachable'));

      await expect(service.getFeed(7, 2)).rejects.toThrow(BadGatewayException);
    });

    it('returns at most the requested limit', async () => {
      mockRecommender.feed.mockResolvedValue([1, 2, 3, 4, 5]);
      respondWithDetails();

      const result = await service.getFeed(7, 2);

      expect(result.data).toHaveLength(2);
    });

    it('widens the window when the first pass cannot fill the page', async () => {
      mockRecommender.feed
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([1, 2, 3, 4, 5, 6, 7, 8]);
      // Only the first two are unplayable, so the widened pass fills the page.
      respondWithDetails([1, 2]);

      const result = await service.getFeed(7, 2);

      expect(mockRecommender.feed).toHaveBeenNthCalledWith(1, 7, 2);
      expect(mockRecommender.feed).toHaveBeenNthCalledWith(2, 7, 4);
      expect(result.data).toHaveLength(2);
    });

    // The seen set is what makes widening cheap: a wider window re-runs the same
    // deterministic ranking, so most of what comes back was already enriched.
    it('never enriches the same id twice across a widened request', async () => {
      mockRecommender.feed
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([1, 2, 3, 4, 5, 6, 7, 8]);
      respondWithDetails([1, 2]);

      await service.getFeed(7, 2);

      const enrichedIds = mockTmdb.getMovieDetail.mock.calls.map(([id]) => id as number);
      expect(new Set(enrichedIds).size).toBe(enrichedIds.length);
    });

    it('stops at the recommender ceiling and returns a short page', async () => {
      // Nothing in the pool is playable, so the page can never fill.
      mockRecommender.feed.mockImplementation((_userId: number, limit: number) =>
        Promise.resolve(Array.from({ length: limit }, (_, index) => index + 1)),
      );
      mockTmdb.getMovieDetail.mockImplementation((id: number) => Promise.resolve(detail(id, null)));

      const result = await service.getFeed(7, 20);

      expect(result.data).toEqual([]);
      // 20 → 40 → 50, then the ceiling ends it.
      expect(mockRecommender.feed).toHaveBeenCalledTimes(3);
      expect(mockRecommender.feed).toHaveBeenLastCalledWith(7, 50);
    });
  });
});
