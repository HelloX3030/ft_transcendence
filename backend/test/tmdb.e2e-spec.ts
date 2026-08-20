import { BadGatewayException, INestApplication, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { apiResponse, TmdbPerson } from '@cinemates/shared';
import { RegisterDto } from 'src/auth/dto';
import { RedisService } from 'src/redis/redis.service';
import { TmdbClient } from 'src/tmdb/tmdb.client';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { createTestApp, register } from './utils';

const viewerRegister: RegisterDto = {
  username: 'tmdbviewer',
  email: 'tmdbviewer@example.com',
  password: 'Test123!',
};

// The throttler buckets per user, so the limit test gets its own account and
// can't starve the rest of the suite.
const flooderRegister: RegisterDto = {
  username: 'tmdbflooder',
  email: 'tmdbflooder@example.com',
  password: 'Test123!',
};

// Swapped per test to script what "TMDB" returns for a given path.
let upstream: (path: string) => Promise<unknown>;
let upstreamCalls: string[];

const personBody = (id: number) => ({
  id,
  name: `Person ${id}`,
  profile_path: '/p.jpg',
  known_for_department: 'Acting',
  biography: 'Bio',
  birthday: null,
  popularity: 1,
});

// Shape-compatible with every endpoint's expectations, so tests that don't care
// about the payload can leave the default in place.
const emptyUpstream = { results: [], page: 1, total_pages: 1, total_results: 0, genres: [] };

describe('Tmdb (e2e)', () => {
  let app: INestApplication;
  let viewer: TestAgent;
  let flooder: TestAgent;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder
        // Stub the one edge that would otherwise hit the network. Everything
        // else, guards, pipes, DTOs, filters, throttler, is the real thing.
        .overrideProvider(TmdbClient)
        .useValue({
          get: (path: string): Promise<unknown> => {
            upstreamCalls.push(path);
            return upstream(path);
          },
        })
        // Force every request to be a cache miss, which both keeps the
        // assertions deterministic and mirrors running with Redis unavailable.
        .overrideProvider(RedisService)
        .useValue({
          get: (): Promise<string | null> => Promise.resolve(null),
          set: (): Promise<void> => Promise.resolve(),
        }),
    );

    viewer = request.agent(app.getHttpServer());
    flooder = request.agent(app.getHttpServer());

    await register(viewer, viewerRegister);
    await register(flooder, flooderRegister);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    upstreamCalls = [];
    upstream = () => Promise.resolve(emptyUpstream);
  });

  describe('authentication', () => {
    it('rejects an unauthenticated request without consuming any TMDB budget', async () => {
      await request(app.getHttpServer()).get('/tmdb/genres').expect(401);

      expect(upstreamCalls).toHaveLength(0);
    });
  });

  describe('query validation', () => {
    it('rejects a whitespace-only search term instead of querying TMDB with nothing', async () => {
      await viewer.get('/tmdb/search').query({ query: '   ' }).expect(400);

      expect(upstreamCalls).toHaveLength(0);
    });

    it('accepts a search term that only needs trimming', async () => {
      await viewer.get('/tmdb/search').query({ query: '  batman ' }).expect(200);

      expect(upstreamCalls[0]).toContain('query=batman');
    });

    it('rejects a date that is well-formed but not a real day', async () => {
      await viewer.get('/tmdb/discover').query({ releaseDateGte: '2026-99-99' }).expect(400);

      expect(upstreamCalls).toHaveLength(0);
    });

    it('rejects an inverted release-date range', async () => {
      await viewer
        .get('/tmdb/discover')
        .query({ releaseDateGte: '2020-01-01', releaseDateLte: '2010-01-01' })
        .expect(400);

      expect(upstreamCalls).toHaveLength(0);
    });

    it('accepts a valid release-date range', async () => {
      await viewer
        .get('/tmdb/discover')
        .query({ releaseDateGte: '2010-01-01', releaseDateLte: '2020-01-01' })
        .expect(200);
    });

    it('rejects a people lookup with no ids, non-numeric ids, or too many ids', async () => {
      await viewer.get('/tmdb/people').query({ ids: '' }).expect(400);
      await viewer.get('/tmdb/people').query({ ids: 'brad,pitt' }).expect(400);
      await viewer
        .get('/tmdb/people')
        .query({ ids: Array.from({ length: 51 }, (_, i) => i + 1).join(',') })
        .expect(400);

      expect(upstreamCalls).toHaveLength(0);
    });
  });

  describe('people lookup', () => {
    it('de-duplicates repeated ids into one upstream call', async () => {
      upstream = (path) => Promise.resolve(personBody(Number(/\/person\/(\d+)/.exec(path)?.[1])));

      const response = await viewer.get('/tmdb/people').query({ ids: '287,287,287' }).expect(200);
      const body = response.body as apiResponse<TmdbPerson[]>;

      expect(upstreamCalls).toHaveLength(1);
      expect(body.data).toHaveLength(1);
    });

    it('skips ids TMDB does not know and returns the rest', async () => {
      upstream = (path) =>
        path.includes('/person/999')
          ? Promise.reject(new NotFoundException('TMDB resource not found'))
          : Promise.resolve(personBody(287));

      const response = await viewer.get('/tmdb/people').query({ ids: '287,999' }).expect(200);
      const body = response.body as apiResponse<TmdbPerson[]>;

      expect(body.data).toEqual([
        { id: 287, name: 'Person 287', profile_path: '/p.jpg', known_for_department: 'Acting' },
      ]);
    });

    it('surfaces a TMDB outage as 502 rather than an empty 200', async () => {
      upstream = () => Promise.reject(new BadGatewayException('TMDB is unreachable'));

      const response = await viewer.get('/tmdb/people').query({ ids: '287,500' }).expect(502);
      const body = response.body as apiResponse<null>;

      expect(body.success).toBe(false);
    });
  });

  describe('upstream error mapping', () => {
    it('maps an unknown movie id to 404', async () => {
      upstream = () => Promise.reject(new NotFoundException('TMDB resource not found'));

      await viewer.get('/tmdb/movies/999999999').expect(404);
    });

    it('maps an unreachable TMDB to 502', async () => {
      upstream = () => Promise.reject(new BadGatewayException('TMDB is unreachable'));

      await viewer.get('/tmdb/discover').expect(502);
    });

    it('rejects a non-numeric movie id before reaching TMDB', async () => {
      await viewer.get('/tmdb/movies/batman').expect(400);

      expect(upstreamCalls).toHaveLength(0);
    });
  });

  describe('per-user throttling', () => {
    // The burst window allows 30 requests per 10s per account.
    it('429s a single account past the burst limit', async () => {
      for (let i = 0; i < 30; i++) {
        await flooder.get('/tmdb/genres').expect(200);
      }

      await flooder.get('/tmdb/genres').expect(429);
    });

    it('leaves other accounts unaffected', async () => {
      await viewer.get('/tmdb/genres').expect(200);
    });
  });
});
