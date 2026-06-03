import { Injectable, Logger } from '@nestjs/common';
import { TmdbListResponse, TmdbMovie } from './tmdb.types';

const TMDB_BASE = 'https://api.themoviedb.org/3';

@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);

  async get(path: string): Promise<TmdbMovie[]> {
    const headers = {
      accept: 'application/json',
      Authorization: `Bearer ${process.env.TMDB_API_KEY!}`,
    };

    let res: Response;
    try {
      res = await fetch(`${TMDB_BASE}${path}`, { headers });
    } catch (err) {
      this.logger.warn(`TMDB network error for ${path}: ${(err as Error).message}`);
      return [];
    }

    if (!res.ok) {
      this.logger.warn(`TMDB responded ${res.status} for ${path}`);
      return [];
    }

    const data = (await res.json()) as TmdbListResponse;
    return data.results;
  }
}
