import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { TmdbListResponse } from './tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 5000;

@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);

  async get(path: string): Promise<TmdbListResponse> {
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

    if (!res.ok) {
      this.logger.warn(`TMDB responded ${res.status} for ${path}`);
      throw new BadGatewayException('TMDB request failed');
    }

    return (await res.json()) as TmdbListResponse;
  }
}
