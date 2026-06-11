import { Injectable, Logger } from '@nestjs/common';
import { TmdbListResponse } from './tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const EMPTY_RESPONSE: TmdbListResponse = {
  page: 0,
  total_pages: 0,
  total_results: 0,
  results: [],
};

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
      res = await fetch(`${TMDB_BASE}${path}`, { headers });
    } catch (err) {
      this.logger.warn(`TMDB network error for ${path}: ${(err as Error).message}`);
      return EMPTY_RESPONSE;
    }

    if (!res.ok) {
      this.logger.warn(`TMDB responded ${res.status} for ${path}`);
      return EMPTY_RESPONSE;
    }

    return (await res.json()) as TmdbListResponse;
  }
}
