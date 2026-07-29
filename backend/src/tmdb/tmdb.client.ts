import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TmdbBudget } from './tmdb.budget';
import { TmdbListResponse } from './tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 5000;

// TMDB allows roughly 50 requests per 10s per API key, shared by every user of
// this backend. We hold ourselves below that so the ceiling is one we enforce
// (and can observe) rather than one TMDB enforces on us with 429s. Callers wait
// up to BUDGET_MAX_WAIT_MS for capacity, then get a 503.
const BUDGET_CAPACITY = 40;
const BUDGET_WINDOW_MS = 10_000;
const BUDGET_MAX_WAIT_MS = 2000;

@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);
  private readonly budget = new TmdbBudget(BUDGET_CAPACITY, BUDGET_WINDOW_MS, BUDGET_MAX_WAIT_MS);

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
    // upstream failure — it gets its own exception so callers that can tolerate a
    // missing resource catch it specifically, without also swallowing outages.
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
