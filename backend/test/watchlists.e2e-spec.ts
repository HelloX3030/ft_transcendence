import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { describe, expect, it, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { RegisterDto } from 'src/auth/dto';
import cookieParser from 'cookie-parser';
import TestAgent from 'supertest/lib/agent';
import { createTestApp } from './utils/create-test-app';
import { checkCookies } from './utils';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

interface WatchlistResponse {
  id: number;
  name: string;
  image: string | null;
  role: 'editor' | 'viewer';
  createdAt: string;
}

interface MovieResponse {
  id: number;
  tmdbId: number;
  name: string;
}

describe('Watchlists (e2e)', () => {
  let app: INestApplication<App>;
  let ownerAgent: TestAgent;
  let viewerAgent: TestAgent;
  let viewerUserId: number;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  beforeAll(async () => {
    app = await createTestApp();

    const ownerCredentials = buildRegisterDto('watchlist-owner');
    const viewerCredentials = buildRegisterDto('watchlist-viewer');

    ownerAgent = await registerUser(app, ownerCredentials);
    viewerAgent = await registerUser(app, viewerCredentials);

    viewerUserId = await getCurrentUserId(viewerAgent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('creates watchlists and returns them in the listing', async () => {
    const created = await createWatchlist(ownerAgent, `My Watchlist ${runId}`);

    expect(created.name).toBe(`My Watchlist ${runId}`);
    expect(created.role).toBe('editor');

    const listResponse = await ownerAgent.get('/watchlists').expect(200);
    const listBody = listResponse.body as ApiResponse<WatchlistResponse[]>;

    expect(listBody.success).toBe(true);
    expect(listBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, name: created.name, role: 'editor' }),
      ]),
    );

    const singleResponse = await ownerAgent.get(`/watchlists/${created.id}`).expect(200);
    const singleBody = singleResponse.body as ApiResponse<WatchlistResponse>;

    expect(singleBody.success).toBe(true);
    expect(singleBody.data).toMatchObject({
      id: created.id,
      name: created.name,
      image: created.image,
      role: 'editor',
    });
  });

  it('updates a watchlist and rejects invalid payloads', async () => {
    const created = await createWatchlist(ownerAgent, `Update Target ${runId}`);

    const updatedName = `Updated Watchlist ${runId}`;
    const updatedImage = 'https://example.com/new-image.jpg';

    const updateResponse = await ownerAgent
      .patch(`/watchlists/${created.id}`)
      .send({ name: updatedName, image: updatedImage })
      .expect(200);

    const updateBody = updateResponse.body as ApiResponse<WatchlistResponse>;
    expect(updateBody.success).toBe(true);
    expect(updateBody.data).toMatchObject({
      id: created.id,
      name: updatedName,
      image: updatedImage,
      role: 'editor',
    });

    const invalidResponse = await ownerAgent
      .patch(`/watchlists/${created.id}`)
      .send({ unexpected: 'field' })
      .expect(400);

    const invalidBody = invalidResponse.body as { error: string };
    expect(invalidBody.error).toBeDefined();
  });

  it('adds, lists and removes movies in a watchlist', async () => {
    const created = await createWatchlist(ownerAgent, `Movies Target ${runId}`);
    const tmdbId = 1234567;
    const movieTitle = `Mocked Movie ${runId}`;

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original_title: movieTitle }),
    } as unknown as Awaited<ReturnType<typeof fetch>>);

    const addResponse = await ownerAgent
      .post(`/watchlists/${created.id}/movies`)
      .send({ tmdbId })
      .expect(201);

    const addBody = addResponse.body as ApiResponse<null>;
    expect(addBody.success).toBe(true);

    const moviesResponse = await ownerAgent.get(`/watchlists/${created.id}/movies`).expect(200);
    const moviesBody = moviesResponse.body as ApiResponse<MovieResponse[]>;

    expect(moviesBody.success).toBe(true);
    expect(moviesBody.data).toHaveLength(1);
    expect(moviesBody.data[0]).toMatchObject({
      tmdbId,
      name: movieTitle,
    });

    const movieId = moviesBody.data[0].id;

    const removeResponse = await ownerAgent
      .delete(`/watchlists/${created.id}/movies/${movieId}`)
      .expect(200);
    const body = removeResponse.body as ApiResponse<null>;
    expect(body.success).toBe(true);

    const emptyResponse = await ownerAgent.get(`/watchlists/${created.id}/movies`).expect(200);
    const emptyBody = emptyResponse.body as ApiResponse<MovieResponse[]>;
    expect(emptyBody.data).toHaveLength(0);
  });

  it('allows viewers to read but not edit a shared watchlist', async () => {
    const created = await createWatchlist(ownerAgent, `Shared Watchlist ${runId}`);

    const addViewerResponse = await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'viewer' })
      .expect(201);

    const addViewerBody = addViewerResponse.body as ApiResponse<null>;
    expect(addViewerBody.success).toBe(true);

    const viewerListResponse = await viewerAgent.get('/watchlists').expect(200);
    const viewerListBody = viewerListResponse.body as ApiResponse<WatchlistResponse[]>;

    expect(viewerListBody.success).toBe(true);
    expect(viewerListBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, name: created.name, role: 'viewer' }),
      ]),
    );

    const viewerUsersResponse = await viewerAgent
      .get(`/watchlists/${created.id}/users`)
      .expect(200);
    const viewerUsersBody = viewerUsersResponse.body as ApiResponse<unknown>;
    expect(viewerUsersBody.success).toBe(true);

    const forbiddenResponse = await viewerAgent
      .patch(`/watchlists/${created.id}`)
      .send({ name: `Blocked ${runId}` })
      .expect(403);

    const forbiddenBody = forbiddenResponse.body as { message: string };
    expect(forbiddenBody.message).toBe('You have read-only access.');
  });

  async function createWatchlist(agent: TestAgent, name: string) {
    const response = await agent
      .post('/watchlists')
      .set('Accept', 'application/json')
      .send({
        name,
        image: 'https://example.com/image.jpg',
      })
      .expect('Content-Type', /json/)
      .expect(201);

    const body = response.body as ApiResponse<WatchlistResponse>;
    expect(body.success).toBe(true);
    return body.data;
  }

  async function registerUser(application: INestApplication<App>, dto: RegisterDto) {
    const agent = request.agent(application.getHttpServer());

    const response = await agent
      .post('/auth/register')
      .set('Accept', 'application/json')
      .send(dto)
      .expect('Content-Type', /json/)
      .expect(201);

    const body = response.body as { message: string };
    expect(body.message).toBe('User registered successfully');
    checkCookies(response);

    return agent;
  }

  async function getCurrentUserId(agent: TestAgent) {
    const response = await agent.get('/auth/me').expect(200);
    const body = response.body as { sub: number };
    return body.sub;
  }
});

function buildRegisterDto(prefix: string): RegisterDto {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    username: `${prefix}-${token}`.slice(0, 32),
    email: `${prefix}-${token}@example.com`,
    password: 'Test123!',
    language: 'en',
  };
}
