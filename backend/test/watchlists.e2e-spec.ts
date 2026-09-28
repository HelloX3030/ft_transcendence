import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { createTestApp } from './utils/create-test-app.utils';
import { checkCookies, userError } from './utils';
import { WATCHLIST_NAME_MAX_LENGTH, WatchlistResponse } from '@cinemates/shared';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

interface MovieResponse {
  id: number;
  tmdbId: number;
  name: string;
  posterPath: string | null;
}

describe('Watchlists (e2e)', () => {
  let app: INestApplication;
  let ownerAgent: TestAgent;
  let viewerAgent: TestAgent;
  let ownerUserId: number;
  let viewerUserId: number;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  // The dev/CI Postgres persists across runs and `movies` rows are cached by
  // tmdbId, so hardcoded ids leak state between runs. Derive run-unique ids
  // (kept under the 4-byte Int max the tmdbId column uses).
  const tmdbBase = Math.floor(Math.random() * 1_000_000_000);

  beforeAll(async () => {
    app = await createTestApp();

    const ownerCredentials = buildRegisterDto('watchlist-owner');
    const viewerCredentials = buildRegisterDto('watchlist-viewer');

    ownerAgent = await registerUser(app, ownerCredentials);
    viewerAgent = await registerUser(app, viewerCredentials);

    ownerUserId = await getCurrentUserId(ownerAgent);
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
      posterPaths: [],
      role: 'editor',
    });
  });

  it('updates a watchlist and rejects invalid payloads', async () => {
    const created = await createWatchlist(ownerAgent, `Update Target ${runId}`);

    const updatedName = `Updated Watchlist ${runId}`;

    const updateResponse = await ownerAgent
      .patch(`/watchlists/${created.id}`)
      .send({ name: updatedName })
      .expect(200);

    const updateBody = updateResponse.body as ApiResponse<WatchlistResponse>;
    expect(updateBody.success).toBe(true);
    expect(updateBody.data).toMatchObject({
      id: created.id,
      name: updatedName,
      role: 'editor',
    });

    const invalidResponse = await ownerAgent
      .patch(`/watchlists/${created.id}`)
      .send({ unexpected: 'field' })
      .expect(400);

    const invalidBody = invalidResponse.body as { error: string };
    expect(invalidBody.error).toBeDefined();
  });

  // The frontend rejects at the same length, so without these the effective
  // contract would be decided entirely client-side.
  describe('name validation', () => {
    const tooLong = 'x'.repeat(WATCHLIST_NAME_MAX_LENGTH + 1);

    it('rejects a name over the limit on create', async () => {
      await ownerAgent.post('/watchlists').send({ name: tooLong }).expect(400);
    });

    it('rejects a whitespace-only name on create', async () => {
      await ownerAgent.post('/watchlists').send({ name: '   ' }).expect(400);
    });

    it('stores a name trimmed', async () => {
      const response = await ownerAgent
        .post('/watchlists')
        .send({ name: `  Trimmed ${runId}  ` })
        .expect(201);

      const body = response.body as ApiResponse<WatchlistResponse>;
      expect(body.data?.name).toBe(`Trimmed ${runId}`);
    });

    it('rejects a name over the limit on update', async () => {
      const created = await createWatchlist(ownerAgent, `Length Target ${runId}`);

      await ownerAgent.patch(`/watchlists/${created.id}`).send({ name: tooLong }).expect(400);
    });

    it('rejects an empty update payload', async () => {
      const created = await createWatchlist(ownerAgent, `Empty Target ${runId}`);

      await ownerAgent.patch(`/watchlists/${created.id}`).send({}).expect(400);
    });
  });

  it('adds, lists and removes movies in a watchlist', async () => {
    const created = await createWatchlist(ownerAgent, `Movies Target ${runId}`);
    const tmdbId = tmdbBase;
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

  it('deletes a shared watchlist and returns success', async () => {
    const created = await createWatchlist(ownerAgent, `Delete Target ${runId}`);

    // Add a second member so the post-delete notify fan-out has recipients:
    // deleting cascades away every membership row, so the notify must not
    // depend on the caller's membership still existing.
    await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'viewer' })
      .expect(201);

    const deleteResponse = await ownerAgent.delete(`/watchlists/${created.id}`).expect(200);
    const deleteBody = deleteResponse.body as ApiResponse<null>;
    expect(deleteBody.success).toBe(true);

    // The watchlist is actually gone for both members.
    await ownerAgent.get(`/watchlists/${created.id}`).expect(404);
    await viewerAgent.get(`/watchlists/${created.id}`).expect(404);
  });

  it('rejects adding a nonexistent user with 404', async () => {
    const created = await createWatchlist(ownerAgent, `AddUser 404 ${runId}`);

    const response = await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: 999999999, role: 'viewer' })
      .expect(userError(404));

    const body = response.body as { message: string };
    expect(body.message).toBe('User not found.');
  });

  it('rejects adding an already-member user with 409', async () => {
    const created = await createWatchlist(ownerAgent, `AddUser 409 ${runId}`);

    await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'viewer' })
      .expect(201);

    const response = await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'viewer' })
      .expect(userError(409));

    const body = response.body as { message: string };
    expect(body.message).toBe('User already added.');
  });

  it('rejects updating the role of a non-member with 404', async () => {
    const created = await createWatchlist(ownerAgent, `UpdateRole 404 ${runId}`);

    const response = await ownerAgent
      .patch(`/watchlists/${created.id}/users/${viewerUserId}`)
      .send({ role: 'editor' })
      .expect(404);

    const body = response.body as { message: string };
    expect(body.message).toBe('User not found.');
  });

  it('rejects removing a non-member with 404', async () => {
    const created = await createWatchlist(ownerAgent, `RemoveUser 404 ${runId}`);

    const response = await ownerAgent
      .delete(`/watchlists/${created.id}/users/${viewerUserId}`)
      .expect(404);

    const body = response.body as { message: string };
    expect(body.message).toBe('User not found.');
  });

  it('exposes editorIds for every editor of a watchlist', async () => {
    const created = await createWatchlist(ownerAgent, `EditorIds ${runId}`);

    // Freshly created: the creator is the sole editor.
    const soloResponse = await ownerAgent.get(`/watchlists/${created.id}`).expect(200);
    const soloBody = soloResponse.body as ApiResponse<WatchlistResponse>;
    expect(soloBody.data.editorIds).toEqual([ownerUserId]);

    // A second editor must appear in editorIds; a viewer must not.
    await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'editor' })
      .expect(201);

    const twoResponse = await ownerAgent.get(`/watchlists/${created.id}`).expect(200);
    const twoBody = twoResponse.body as ApiResponse<WatchlistResponse>;
    expect(twoBody.data.editorIds).toEqual(expect.arrayContaining([ownerUserId, viewerUserId]));
    expect(twoBody.data.editorIds).toHaveLength(2);

    // The listing endpoint must report the same editorIds as the single fetch.
    const listResponse = await ownerAgent.get('/watchlists').expect(200);
    const listBody = listResponse.body as ApiResponse<WatchlistResponse[]>;
    const listed = listBody.data.find((wl) => wl.id === created.id);
    expect(listed?.editorIds).toEqual(expect.arrayContaining([ownerUserId, viewerUserId]));
    expect(listed?.editorIds).toHaveLength(2);
  });

  it('promotes a viewer to editor', async () => {
    const created = await createWatchlist(ownerAgent, `Promote ${runId}`);

    await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'viewer' })
      .expect(201);

    await ownerAgent
      .patch(`/watchlists/${created.id}/users/${viewerUserId}`)
      .send({ role: 'editor' })
      .expect(200);

    // The promoted user can now edit and sees their own role as editor.
    const selfView = await viewerAgent.get(`/watchlists/${created.id}`).expect(200);
    const selfBody = selfView.body as ApiResponse<WatchlistResponse>;
    expect(selfBody.data.role).toBe('editor');

    await viewerAgent
      .patch(`/watchlists/${created.id}`)
      .send({ name: `Promoted Edit ${runId}` })
      .expect(200);
  });

  it('removes a member who then loses access', async () => {
    const created = await createWatchlist(ownerAgent, `RemoveMember ${runId}`);

    await ownerAgent
      .post(`/watchlists/${created.id}/users`)
      .send({ userId: viewerUserId, role: 'viewer' })
      .expect(201);
    await viewerAgent.get(`/watchlists/${created.id}`).expect(200);

    await ownerAgent.delete(`/watchlists/${created.id}/users/${viewerUserId}`).expect(200);

    // Removed member loses access; the remover keeps it.
    await viewerAgent.get(`/watchlists/${created.id}`).expect(404);
    await ownerAgent.get(`/watchlists/${created.id}`).expect(200);
  });

  it('prevents the last editor from removing themselves', async () => {
    const created = await createWatchlist(ownerAgent, `LastEditor ${runId}`);

    const response = await ownerAgent
      .delete(`/watchlists/${created.id}/users/${ownerUserId}`)
      .expect(409);

    const body = response.body as { message: string };
    expect(body.message).toBe('The last editor cannot be removed. Delete the watchlist instead.');
  });

  it('reuses a single movie row across watchlists sharing the same tmdbId', async () => {
    const listA = await createWatchlist(ownerAgent, `Shared Movie A ${runId}`);
    const listB = await createWatchlist(ownerAgent, `Shared Movie B ${runId}`);
    const tmdbId = tmdbBase + 1;
    const movieTitle = `Shared Mock ${runId}`;

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original_title: movieTitle }),
    } as unknown as Awaited<ReturnType<typeof fetch>>);

    await ownerAgent.post(`/watchlists/${listA.id}/movies`).send({ tmdbId }).expect(201);
    await ownerAgent.post(`/watchlists/${listB.id}/movies`).send({ tmdbId }).expect(201);

    const moviesA = (await ownerAgent.get(`/watchlists/${listA.id}/movies`).expect(200))
      .body as ApiResponse<MovieResponse[]>;
    const moviesB = (await ownerAgent.get(`/watchlists/${listB.id}/movies`).expect(200))
      .body as ApiResponse<MovieResponse[]>;

    expect(moviesA.data).toHaveLength(1);
    expect(moviesB.data).toHaveLength(1);
    // Same underlying movie row (same id + tmdbId) shared by both watchlists.
    expect(moviesA.data[0].tmdbId).toBe(tmdbId);
    expect(moviesA.data[0].id).toBe(moviesB.data[0].id);
  });

  it('rejects adding the same movie twice with 409', async () => {
    const created = await createWatchlist(ownerAgent, `Duplicate Movie ${runId}`);
    const tmdbId = tmdbBase + 2;

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ original_title: `Dup Mock ${runId}` }),
    } as unknown as Awaited<ReturnType<typeof fetch>>);

    await ownerAgent.post(`/watchlists/${created.id}/movies`).send({ tmdbId }).expect(201);

    const response = await ownerAgent
      .post(`/watchlists/${created.id}/movies`)
      .send({ tmdbId })
      .expect(userError(409));

    const body = response.body as { message: string };
    expect(body.message).toBe('Movie already added.');
  });

  async function createWatchlist(agent: TestAgent, name: string) {
    const response = await agent
      .post('/watchlists')
      .set('Accept', 'application/json')
      .send({ name })
      .expect('Content-Type', /json/)
      .expect(201);

    const body = response.body as ApiResponse<WatchlistResponse>;
    expect(body.success).toBe(true);
    console.log(body);
    return body.data;
  }

  async function registerUser(application: INestApplication, dto: RegisterDto) {
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
    const body = (response.body as { data: { sub: number } }).data;
    return body.sub;
  }
});

function buildRegisterDto(prefix: string): RegisterDto {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    username: `${prefix}-${token}`.slice(0, 32),
    email: `${prefix}-${token}@example.com`,
    password: 'Test123!',
  };
}
