import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { movies } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MovieUtils {
  private readonly logger = new Logger(MovieUtils.name);

  constructor(private prisma: PrismaService) {}

  /** The local `movies` row for a TMDB id, creating it from TMDB metadata if new. */
  async ensureMovie(tmdbId: number): Promise<movies> {
    const movie = await this.prisma.movies.findUnique({
      where: { tmdbId },
    });
    if (movie !== null) {
      return movie;
    }

    const meta = await this.getMovieMeta(tmdbId);
    // upsert (not create) so a concurrent first-add of the same tmdbId that
    // won the race is reused instead of hitting the unique constraint.
    return this.prisma.movies.upsert({
      where: { tmdbId },
      create: {
        tmdbId,
        name: meta.name,
        posterPath: meta.posterPath,
      },
      update: {},
    });
  }

  private async getMovieMeta(tmdbId: number): Promise<{ name: string; posterPath: string | null }> {
    const url = 'https://api.themoviedb.org/3/movie/' + tmdbId;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + process.env.TMDB_API_KEY,
      },
    };

    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
      const json: unknown = (await res.json()) as unknown;

      if (
        typeof json !== 'object' ||
        json === null ||
        !('original_title' in json) ||
        typeof json.original_title !== 'string'
      ) {
        throw new Error('Invalid TMDB API response.');
      }

      const posterPath =
        'poster_path' in json && typeof json.poster_path === 'string' ? json.poster_path : null;

      return { name: json.original_title, posterPath };
    } catch (error) {
      this.logger.error('Failed to fetch movie details from TMDB', error as Error);
      throw new InternalServerErrorException();
    }
  }
}
