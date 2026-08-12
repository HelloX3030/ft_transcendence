import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { MovieUtils } from 'src/utils/movie.utils';
import { MoviesService } from './movies.service';

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

function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', { code, clientVersion: '5.0.0' });
}

describe('MoviesService', () => {
  let service: MoviesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoviesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MovieUtils, useValue: mockMovieUtils },
      ],
    }).compile();

    service = module.get<MoviesService>(MoviesService);
    jest.clearAllMocks();
    mockMovieUtils.ensureMovie.mockResolvedValue(mockMovie);
    mockPrisma.ratings.create.mockResolvedValue(undefined);
  });

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
});
