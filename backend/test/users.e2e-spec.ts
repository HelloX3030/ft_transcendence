import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import {
  apiResponse,
  GetUserResponse,
  UserMeResponse,
  UserSearchResponse,
} from '@trailertinder/shared';
import { checkCookies, createTestApp } from './utils';

// A real 1x1 PNG and a real 1x1 JPEG — the upload path sniffs magic bytes, so the
// fixtures must actually be the formats they claim to be.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);
const SVG_XSS = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>',
);

const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL!;
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT!;
const MINIO_BUCKET = process.env.MINIO_BUCKET!;

// Stored avatar URLs use MINIO_PUBLIC_URL (browser-facing, e.g. http://localhost:9000),
// which does not resolve from inside the backend container. Swap in the in-network
// endpoint so the tests can actually fetch the object back.
function internalUrl(imageUrl: string): string {
  return imageUrl.replace(MINIO_PUBLIC_URL, MINIO_ENDPOINT);
}

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app !== undefined) await app.close();
  });

  describe('GET /users/me', () => {
    it('returns the authenticated profile', async () => {
      const dto = buildRegisterDto('me');
      const agent = await registerUser(app, dto);

      const response = await agent.get('/users/me').expect(200);
      const body = response.body as apiResponse<UserMeResponse>;

      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: expect.any(Number),
        username: dto.username,
        email: dto.email,
        language: 'en',
        image: null,
        onboardingCompleted: false,
        totpActive: false,
      });
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('updates the writable profile fields', async () => {
      const agent = await registerUser(app, buildRegisterDto('patch'));
      const newName = `renamed-${token()}`;

      const response = await agent
        .patch('/users/me')
        .send({ username: newName, language: 'de' })
        .expect(200);

      const body = response.body as apiResponse<UserMeResponse>;
      expect(body.data).toMatchObject({ username: newName, language: 'de' });
    });

    it('returns 409 when the username is already taken', async () => {
      const existing = buildRegisterDto('taken-name');
      await registerUser(app, existing);
      const agent = await registerUser(app, buildRegisterDto('patch-name'));

      const response = await agent
        .patch('/users/me')
        .send({ username: existing.username })
        .expect(409);

      expect((response.body as apiResponse<null>).message).toBe('Username already taken');
    });

    it('returns 409 when the email is already taken', async () => {
      const existing = buildRegisterDto('taken-mail');
      await registerUser(app, existing);
      const agent = await registerUser(app, buildRegisterDto('patch-mail'));

      const response = await agent.patch('/users/me').send({ email: existing.email }).expect(409);

      expect((response.body as apiResponse<null>).message).toBe('Email already taken');
    });

    it('refuses to set the avatar URL directly — avatars come only from the upload route', async () => {
      const agent = await registerUser(app, buildRegisterDto('patch-image'));

      await agent
        .patch('/users/me')
        .send({ image: 'https://evil.example.com/payload.svg' })
        .expect(400);

      const body = (await agent.get('/users/me').expect(200)).body as apiResponse<UserMeResponse>;
      expect(body.data!.image).toBeNull();
    });

    it('rejects a malformed email', async () => {
      const agent = await registerUser(app, buildRegisterDto('patch-bad'));

      await agent.patch('/users/me').send({ email: 'not-an-email' }).expect(400);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).patch('/users/me').send({ language: 'de' }).expect(401);
    });
  });

  describe('POST /users/me/onboarding', () => {
    const tenIds = [27205, 157336, 24428, 155, 550, 680, 13, 120, 122, 597];

    it('completes onboarding and stamps preferences', async () => {
      const agent = await registerUser(app, buildRegisterDto('onboard'));

      const response = await agent
        .post('/users/me/onboarding')
        .send({ movieIds: tenIds })
        .expect(201);

      const body = response.body as apiResponse<UserMeResponse>;
      expect(body.data).toMatchObject({ onboardingCompleted: true });
      expect(body.data!.genreIds.length).toBeGreaterThan(0);
    });

    it('returns 409 on a repeat call and leaves preferences untouched', async () => {
      const agent = await registerUser(app, buildRegisterDto('onboard-twice'));

      const first = await agent.post('/users/me/onboarding').send({ movieIds: tenIds }).expect(201);
      const stamped = (first.body as apiResponse<UserMeResponse>).data!;

      const repeat = await agent
        .post('/users/me/onboarding')
        .send({ movieIds: tenIds })
        .expect(409);
      expect((repeat.body as apiResponse<null>).message).toBe('Onboarding already completed');

      const after = (await agent.get('/users/me').expect(200)).body as apiResponse<UserMeResponse>;
      expect(after.data!.genreIds).toEqual(stamped.genreIds);
    });

    it.each([
      ['fewer than ten ids', tenIds.slice(0, 9)],
      ['more than ten ids', [...tenIds, 603]],
      ['ten ids padded with a duplicate', [...tenIds.slice(0, 9), 27205]],
      ['a non-positive id', [...tenIds.slice(0, 9), 0]],
    ])('rejects %s', async (_name, movieIds) => {
      const agent = await registerUser(app, buildRegisterDto('onboard-bad'));

      await agent.post('/users/me/onboarding').send({ movieIds }).expect(400);
    });
  });

  describe('POST /users/me/avatar', () => {
    it('stores a PNG and serves it from the bucket as image/png', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar'));

      const response = await agent
        .post('/users/me/avatar')
        .attach('file', PNG_1X1, { filename: 'me.png', contentType: 'image/png' })
        .expect(201);

      const image = (response.body as apiResponse<UserMeResponse>).data!.image!;
      expect(image).toMatch(
        new RegExp(
          `^${escapeRegExp(`${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/`)}\\d+-\\d+-[0-9a-f]+\\.png$`,
        ),
      );

      const stored = await fetch(internalUrl(image));
      expect(stored.status).toBe(200);
      expect(stored.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await stored.arrayBuffer())).toEqual(PNG_1X1);
    });

    it('derives the extension from the bytes, not the filename', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar-ext'));

      // A PNG announced as "payload.svg": the key must not inherit that extension.
      const response = await agent
        .post('/users/me/avatar')
        .attach('file', PNG_1X1, { filename: 'payload.svg', contentType: 'image/png' })
        .expect(201);

      const image = (response.body as apiResponse<UserMeResponse>).data!.image!;
      expect(image).toMatch(/\.png$/);
      expect(image).not.toContain('svg');
    });

    it('accepts a JPEG and labels it image/jpeg', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar-jpeg'));

      const response = await agent
        .post('/users/me/avatar')
        .attach('file', JPEG_1X1, { filename: 'me.jpg', contentType: 'image/jpeg' })
        .expect(201);

      const image = (response.body as apiResponse<UserMeResponse>).data!.image!;
      expect(image).toMatch(/\.jpg$/);

      const stored = await fetch(internalUrl(image));
      expect(stored.headers.get('content-type')).toBe('image/jpeg');
    });

    it('rejects SVG bytes that lie about their mimetype', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar-svg'));

      await agent
        .post('/users/me/avatar')
        .attach('file', SVG_XSS, { filename: 'me.png', contentType: 'image/png' })
        .expect(400);

      const body = (await agent.get('/users/me').expect(200)).body as apiResponse<UserMeResponse>;
      expect(body.data!.image).toBeNull();
    });

    it('rejects a declared image/svg+xml upload', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar-svgtype'));

      await agent
        .post('/users/me/avatar')
        .attach('file', SVG_XSS, { filename: 'me.svg', contentType: 'image/svg+xml' })
        .expect(400);
    });

    it('rejects a request with no file', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar-none'));

      await agent.post('/users/me/avatar').expect(400);
    });

    it('removes the previous object when a new avatar replaces it', async () => {
      const agent = await registerUser(app, buildRegisterDto('avatar-replace'));

      const first = await agent
        .post('/users/me/avatar')
        .attach('file', PNG_1X1, { filename: 'first.png', contentType: 'image/png' })
        .expect(201);
      const firstImage = (first.body as apiResponse<UserMeResponse>).data!.image!;

      const second = await agent
        .post('/users/me/avatar')
        .attach('file', PNG_1X1, { filename: 'second.png', contentType: 'image/png' })
        .expect(201);
      const secondImage = (second.body as apiResponse<UserMeResponse>).data!.image!;

      expect(secondImage).not.toBe(firstImage);
      expect((await fetch(internalUrl(firstImage))).status).toBe(404);
      expect((await fetch(internalUrl(secondImage))).status).toBe(200);
    });

    it('rejects an unauthenticated upload', async () => {
      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .attach('file', PNG_1X1, { filename: 'me.png', contentType: 'image/png' })
        .expect(401);
    });
  });

  describe('GET /users/search', () => {
    const prefix = `srch${token()}`;
    let searcher: TestAgent;
    let searcherName: string;
    let targetName: string;

    beforeAll(async () => {
      const searcherDto = buildRegisterDto(prefix);
      const targetDto = buildRegisterDto(prefix);
      searcher = await registerUser(app, searcherDto);
      await registerUser(app, targetDto);
      searcherName = searcherDto.username;
      targetName = targetDto.username;
    });

    it('finds other users and excludes the requester', async () => {
      const response = await searcher.get(`/users/search?query=${prefix}`).expect(200);
      const body = response.body as apiResponse<UserSearchResponse>;

      const names = body.data!.results.map((user) => user.username);
      expect(names).toContain(targetName);
      expect(names).not.toContain(searcherName);
    });

    it('paginates the results', async () => {
      const response = await searcher
        .get(`/users/search?query=${prefix}&page=1&limit=1`)
        .expect(200);
      const body = response.body as apiResponse<UserSearchResponse>;

      expect(body.data!.results).toHaveLength(1);
      expect(body.data).toMatchObject({ page: 1, limit: 1 });
    });

    it('trims the query before matching', async () => {
      const response = await searcher.get(`/users/search?query=  ${prefix}  `).expect(200);
      const body = response.body as apiResponse<UserSearchResponse>;

      expect(body.data!.results.map((user) => user.username)).toContain(targetName);
    });

    it('rejects a whitespace-only query', async () => {
      await searcher.get('/users/search?query=%20%20').expect(400);
    });

    it('rejects a missing query', async () => {
      await searcher.get('/users/search').expect(400);
    });

    it('rejects a limit above the maximum', async () => {
      await searcher.get(`/users/search?query=${prefix}&limit=51`).expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('returns only the public profile fields', async () => {
      const targetDto = buildRegisterDto('public');
      const target = await registerUser(app, targetDto);
      const targetId = await getUserId(target);
      const viewer = await registerUser(app, buildRegisterDto('viewer'));

      const response = await viewer.get(`/users/${targetId}`).expect(200);
      const body = response.body as apiResponse<GetUserResponse>;

      expect(body.data).toEqual({
        id: targetId,
        username: targetDto.username,
        image: null,
      });
    });

    it('returns 404 for an unknown id', async () => {
      const agent = await registerUser(app, buildRegisterDto('missing'));

      await agent.get('/users/99999999').expect(404);
    });

    it('returns 400 for a non-numeric id', async () => {
      const agent = await registerUser(app, buildRegisterDto('badid'));

      await agent.get('/users/not-a-number').expect(400);
    });
  });

  describe('DELETE /users/me', () => {
    it('deletes the account and its stored avatar', async () => {
      const agent = await registerUser(app, buildRegisterDto('delete'));

      const upload = await agent
        .post('/users/me/avatar')
        .attach('file', PNG_1X1, { filename: 'me.png', contentType: 'image/png' })
        .expect(201);
      const image = (upload.body as apiResponse<UserMeResponse>).data!.image!;
      expect((await fetch(internalUrl(image))).status).toBe(200);

      await agent.delete('/users/me').expect(200);

      // The token is still valid — the row behind it is gone.
      await agent.get('/users/me').expect(404);
      expect((await fetch(internalUrl(image))).status).toBe(404);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).delete('/users/me').expect(401);
    });
  });
});

async function registerUser(application: INestApplication, dto: RegisterDto): Promise<TestAgent> {
  const agent = request.agent(application.getHttpServer());

  const response = await agent
    .post('/auth/register')
    .set('Accept', 'application/json')
    .send(dto)
    .expect('Content-Type', /json/)
    .expect(201);

  checkCookies(response);
  return agent;
}

async function getUserId(agent: TestAgent): Promise<number> {
  const body = (await agent.get('/users/me').expect(200)).body as apiResponse<UserMeResponse>;
  return body.data!.id;
}

// The dev/CI Postgres persists across runs, so every user must be unique per run.
function token(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function buildRegisterDto(prefix: string): RegisterDto {
  const suffix = token();
  return {
    username: `${prefix}-${suffix}`.slice(0, 32),
    email: `${prefix}-${suffix}@example.com`,
    password: 'Test123!',
    language: 'en',
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
