import { Injectable } from '@nestjs/common';

const TMDB_BASE = 'https://api.themoviedb.org/3';

@Injectable()
export class PopularService {
  private readonly headers = {
    accept: 'application/json',
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  };

  async fetchPopular(): Promise<unknown> {
    const res = await fetch(`${TMDB_BASE}/movie/popular?language=en-US&page=1`, {
      headers: this.headers,
    });
    return res.json();
  }
}
