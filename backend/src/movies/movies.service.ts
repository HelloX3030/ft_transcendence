import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, reaction_type } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { successResponse } from 'src/utils';
import { MovieUtils } from 'src/utils/movie.utils';

@Injectable()
export class MoviesService {
  constructor(
    private prisma: PrismaService,
    private movieUtils: MovieUtils,
  ) {}

  async setReaction(tmdbId: number, reaction: reaction_type, userId: number) {
    const movie = await this.movieUtils.ensureMovie(tmdbId);

    try {
      // create, not upsert: a reaction is written once and never replaced. The
      // composite PK is what enforces that, so the race is decided by the
      // database rather than by a read-then-write that two requests could both
      // pass.
      await this.prisma.ratings.create({
        data: { userId, movieId: movie.id, trailerRating: reaction },
      });
    } catch (error) {
      // Caught here rather than left to PrismaExceptionFilter: the filter's
      // "The record already exists" says nothing to a reader of the docs.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already reacted to this movie.');
      }
      throw error;
    }

    return successResponse({ tmdbId, reaction });
  }
}
