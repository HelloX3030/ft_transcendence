import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TmdbListResponse } from './tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 5000;

@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);

  async get<T = TmdbListResponse>(path: string): Promise<T> {
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
