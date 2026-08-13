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
// An empty feed has two causes that need telling apart. Nothing about the
// response shape distinguished them, so a profile too thin to query against
// looked exactly like TMDB dropping every candidate on the floor.
export const FEED_EMPTY_NO_CANDIDATES = 'The recommender has nothing new for this user.';
export const FEED_EMPTY_NONE_PLAYABLE = 'Recommended films were found, but none had a trailer.';
// One TMDB detail call per candidate. Well under the per-IP connection ceiling
// TMDB's CDN is reported to apply, and paced by the budget in tmdb.client.ts.
const ENRICH_CONCURRENCY = 8;

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
    // Ids already enriched, so a widened window re-fetches nothing.
    const seen = new Set<number>();
    let window = limit;
    // Films the recommender put forward that we had not already ruled out. The
    // only thing that separates "nothing was recommended" from "everything
    // recommended turned out to be unplayable".
    let candidates = 0;

    while (cards.length < limit) {
      const ids = (await this.recommender.feed(userId, window)).filter((id) => !seen.has(id));
      ids.forEach((id) => seen.add(id));
      candidates += ids.length;

      const enriched = await mapWithConcurrency(ids, ENRICH_CONCURRENCY, (id) => this.enrich(id));
      cards.push(...enriched.filter((card): card is FeedMovie => card !== null));

      // The recommender's /feed has no cursor, so a wider window is the only
      // "more" available. At its ceiling there is nothing left to widen to —
      // return a short page rather than spinning forever.
      if (window >= FEED_MAX_LIMIT) break;
      window = Math.min(window * 2, FEED_MAX_LIMIT);
    }

    const page = cards.slice(0, limit);
    if (page.length > 0) return successResponse(page);

    // Both of these used to be a bare empty array, which left the caller — and
    // anyone reading the logs — unable to tell a cold profile apart from a TMDB
    // problem, when only one of the two is worth acting on.
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
      // No YouTube trailer means nothing to play. Not an error — just not for
      // this feed.
      if (!data?.trailerKey) return null;
      return toFeedMovie(data, data.trailerKey);
    } catch (error) {
      // A 404 is a definitive answer about one id: drop that movie and keep the
      // page. Anything else is TMDB unreachable or over budget, and has to
      // surface as a failed request rather than be disguised as a short feed.
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

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

    // Fire-and-forget, and only here: after the row is committed, so a signal is
    // never sent for a reaction that was not recorded — and never on the 409
    // path, since that reaction's signal was sent when the row was first
    // written. Signals accumulate into the taste profile, so a second send would
    // double a preference the user expressed once.
    this.recommender.signal(userId, tmdbId, reaction);

    return successResponse({ tmdbId, reaction });
  }
}
