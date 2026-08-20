import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TmdbBudget } from './tmdb.budget';
import { TmdbListResponse } from './tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 5000;

// A ceiling we impose on ourselves, so it is observed here rather than arriving
// as 429s from TMDB, whose own limit is soft and undocumented since 2019. Both
// numbers live in the environment (TMDB_RATE_LIMIT, TMDB_RATE_WINDOW_SECONDS) so
// turning them down needs no rebuild. Callers wait up to BUDGET_MAX_WAIT_MS for
// capacity, then get a 503.
const BUDGET_MAX_WAIT_MS = 2000;

@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);
  private readonly budget: TmdbBudget;

  constructor() {
    this.budget = new TmdbBudget(
      Number(process.env.TMDB_RATE_LIMIT),
      Number(process.env.TMDB_RATE_WINDOW_SECONDS) * 1000,
      BUDGET_MAX_WAIT_MS,
    );
  }

  async get<T = TmdbListResponse>(path: string): Promise<T> {
    // Every outbound TMDB call passes through here, so the budget is enforced
    // for all endpoints regardless of which caller (or cache state) got us here.
    await this.budget.acquire();

    const headers = {
      accept: 'application/json',
      Authorization: `Bearer ${process.env.TMDB_API_KEY!}`,
    };

    let res: Response;
    try {
      res = await fetch(`${TMDB_BASE}${path}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`TMDB network error for ${path}: ${(err as Error).message}`);
      throw new BadGatewayException('TMDB is unreachable');
    }

    // A 404 is a definitive answer about one resource ("no such id"), not an
    // upstream failure, so it gets its own exception: callers that can tolerate a
    // missing resource catch it specifically, without swallowing outages.
    if (res.status === 404) {
      this.logger.warn(`TMDB responded 404 for ${path}`);
      throw new NotFoundException('TMDB resource not found');
    }

    if (!res.ok) {
      this.logger.warn(`TMDB responded ${res.status} for ${path}`);
      throw new BadGatewayException('TMDB request failed');
    }

    return (await res.json()) as T;
  }
}
