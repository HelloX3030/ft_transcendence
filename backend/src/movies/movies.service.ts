import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FeedMovie, TmdbMovieDetail } from '@cinemates/shared';
import { Prisma, reaction_type } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RecommenderClient } from 'src/recommender/recommender.client';
import { TmdbService } from 'src/tmdb/tmdb.service';
import { mapWithConcurrency, successResponse } from 'src/utils';
import { MovieUtils } from 'src/utils/movie.utils';

export const FEED_DEFAULT_LIMIT = 20;
// The recommendation service's own ceiling, from its request schema.
export const FEED_MAX_LIMIT = 50;
// An empty feed has two causes that need telling apart: a profile too thin to
// query against, and TMDB dropping every candidate.
export const FEED_EMPTY_NO_CANDIDATES = 'The recommender has nothing new for this user.';
export const FEED_EMPTY_NONE_PLAYABLE = 'Recommended films were found, but none had a trailer.';
// One TMDB detail call per candidate. Well under the per-IP connection ceiling
// TMDB's CDN is reported to apply, and paced by the budget in tmdb.client.ts.
const ENRICH_CONCURRENCY = 8;
// How many times a single getFeed will ask the recommender for another page
// before returning a short feed. Each attempt costs one /feed call plus the
// enrichment of everything it returns, so this bounds latency and TMDB traffic.
const FEED_MAX_ATTEMPTS = 4;

function toFeedMovie(detail: TmdbMovieDetail, trailerKey: string): FeedMovie {
  return {
    tmdbId: detail.id,
    title: detail.title,
    overview: detail.overview,
    posterPath: detail.poster_path,
    backdropPath: detail.backdrop_path,
    releaseDate: detail.release_date,
    genreIds: detail.genres.map((genre) => genre.id),
    trailerKey,
    voteAverage: detail.vote_average,
  };
}

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    private prisma: PrismaService,
    private movieUtils: MovieUtils,
    private recommender: RecommenderClient,
    private tmdb: TmdbService,
  ) {}

  async getFeed(userId: number, limit: number) {
    const cards: FeedMovie[] = [];
    // Ids already enriched, so a later page re-fetches nothing.
    const seen = new Set<number>();
    // Films the recommender put forward that were not already ruled out. This is
    // what separates "nothing was recommended" from "nothing was playable".
    let candidates = 0;

    // Ask for page after page rather than for one ever-wider page: a wider
    // window used to return the same films again, because the recommender had
    // no way to tell one call in a session from the next.
    for (let cursor = 0; cursor < FEED_MAX_ATTEMPTS && cards.length < limit; cursor++) {
      const recommended = await this.recommender.feed(userId, limit, cursor);
      // The recommender falls back to unconstrained popular films before it
      // gives up, so an empty answer means it genuinely has nothing left and
      // paging further will not change that.
      if (recommended.length === 0) break;

      const ids = recommended.filter((id) => !seen.has(id));
      ids.forEach((id) => seen.add(id));
      candidates += ids.length;

      const enriched = await mapWithConcurrency(ids, ENRICH_CONCURRENCY, (id) => this.enrich(id));
      cards.push(...enriched.filter((card): card is FeedMovie => card !== null));
    }

    const page = cards.slice(0, limit);
    if (page.length > 0) return successResponse(page);

    // Named rather than a bare empty array: only one of the two causes is worth
    // acting on, and the caller cannot tell them apart otherwise.
    if (candidates === 0) {
      this.logger.warn(`Empty feed for user ${userId}: the recommender returned no new films`);
      return successResponse(page, FEED_EMPTY_NO_CANDIDATES);
    }
    this.logger.warn(
      `Empty feed for user ${userId}: none of the ${candidates} recommended films had a trailer`,
    );
    return successResponse(page, FEED_EMPTY_NONE_PLAYABLE);
  }

  /** A playable card, or null when this movie cannot be shown. */
  private async enrich(tmdbId: number): Promise<FeedMovie | null> {
    try {
      const { data } = await this.tmdb.getMovieDetail(tmdbId);
      // No YouTube trailer means nothing to play. Not an error, just not for
      // this feed.
      if (!data?.trailerKey) return null;
      return toFeedMovie(data, data.trailerKey);
    } catch (error) {
      // A 404 is a definitive answer about one id: drop that movie and keep the
      // page. Anything else is TMDB unreachable or over budget, and has to
      // surface as a failed request rather than a short feed.
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async getReaction(tmdbId: number, userId: number) {
    // No ensureMovie: a movie nobody has reacted to has no row, and a read must
    // not create one.
    const rating = await this.prisma.ratings.findFirst({
      where: { userId, movie: { tmdbId } },
      select: { trailerRating: true },
    });
    return successResponse({ tmdbId, reaction: rating?.trailerRating ?? null });
  }

  async setReaction(tmdbId: number, reaction: reaction_type, userId: number) {
    const movie = await this.movieUtils.ensureMovie(tmdbId);

    try {
      // create, not upsert: a reaction is written once and never replaced. The
      // composite PK enforces it, so the race is decided by the database rather
      // than a read-then-write two requests could both pass.
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

    // Fire-and-forget, and only after the row is committed, so no signal is sent
    // for a reaction that was not recorded. Never on the 409 path either: signals
    // accumulate into the taste profile, so a second send would double a
    // preference the user expressed once.
    this.recommender.signal(userId, tmdbId, reaction);

    return successResponse({ tmdbId, reaction });
  }
}
