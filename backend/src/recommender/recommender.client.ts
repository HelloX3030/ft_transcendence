import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

const FEED_TIMEOUT_MS = 5000; // matches TmdbClient's TIMEOUT_MS
const SIGNAL_TIMEOUT_MS = 2000; // fire-and-forget: fail fast, never queue behind a swipe

type ReactionAction = 'like' | 'dislike';

interface ScoredMovie {
  movie_id: number;
  score: number;
}

/**
 * The only place that knows the recommendation service's URL or its wire
 * format. The service speaks snake_case (Pydantic) and takes `user_id` as a
 * string, so the translation stops here rather than leaking into MoviesService.
 */
@Injectable()
export class RecommenderClient {
  private readonly logger = new Logger(RecommenderClient.name);

  /**
   * TMDB ids, best first. Already excludes everything the user has rated.
   *
   * `cursor` is how many feeds deep into this browsing session the caller
   * already is: 0 is the first page, and raising it walks the recommender's
   * candidate window forward. Without it every call inside one session returns
   * the same films, since the service has no other way to tell them apart.
   */
  async feed(userId: number, limit: number, cursor = 0): Promise<number[]> {
    const scored = await this.post<ScoredMovie[]>(
      '/feed',
      { user_id: String(userId), limit, cursor },
      FEED_TIMEOUT_MS,
    );
    return scored.map((movie) => movie.movie_id);
  }

  /**
   * Fire-and-forget by design: a swipe must never wait on, or be failed by, the
   * recommendation service. Returns void rather than a promise so no caller can
   * accidentally await it, and the .catch is mandatory, since an unhandled
   * rejection would take the process down.
   *
   * `movieId` is the TMDB id, not our internal movies.id.
   */
  signal(userId: number, movieId: number, action: ReactionAction): void {
    void this.post(
      '/signal',
      { user_id: String(userId), movie_id: movieId, action },
      SIGNAL_TIMEOUT_MS,
    ).catch((error: Error) =>
      this.logger.warn(
        `signal ${action} for user ${userId} / movie ${movieId} failed: ${error.message}`,
      ),
    );
  }

  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    const url = `${process.env.RECOMMENDER_URL}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(`Recommender network error for ${path}: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Recommendations are temporarily unavailable');
    }

    if (!res.ok) {
      this.logger.warn(`Recommender responded ${res.status} for ${path}`);
      throw new ServiceUnavailableException('Recommendations are temporarily unavailable');
    }

    // /signal answers 204 with no body, and res.json() throws on an empty one,
    // which the caller's .catch would then log as a failure that did not happen.
    if (res.status === 204) return undefined as T;

    return (await res.json()) as T;
  }
}
