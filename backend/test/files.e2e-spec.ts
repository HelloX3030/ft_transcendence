import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { apiResponse, UserMeResponse } from '@cinemates/shared';
import { checkCookies, createTestApp } from './utils';

// A real 1x1 PNG — the upload path sniffs magic bytes, so the fixture must
// actually be the format it claims to be.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Files (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app !== undefined) await app.close();
  });

  describe('GET /files/:id', () => {
    it('serves the owner their own file with the stored content type', async () => {
      const agent = await registerUser(app, buildRegisterDto('file-own'));
      const fileId = await uploadAvatar(agent);

      const response = await agent.get(`/files/${fileId}`).expect(200);

      expect(response.headers['content-type']).toContain('image/png');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-disposition']).toBe('inline');
      expect(response.headers['cache-control']).toBe('private, max-age=31536000, immutable');
      expect(response.body).toEqual(PNG_1X1);
    });

    it('rejects an unauthenticated request', async () => {
      // The test that proves the bucket is closed: without a session there is no
      // path to the bytes at all, because the browser cannot reach MinIO either.
      const agent = await registerUser(app, buildRegisterDto('file-anon'));
      const fileId = await uploadAvatar(agent);

      await request(app.getHttpServer()).get(`/files/${fileId}`).expect(401);
    });

    it('lets another signed-in user read an avatar', async () => {
      // Avatars appear on profiles, friend lists and chat headers, so this is
      // the intended rule for this kind — not an accident of a blanket policy.
      const owner = await registerUser(app, buildRegisterDto('file-owner'));
      const other = await registerUser(app, buildRegisterDto('file-other'));
      const fileId = await uploadAvatar(owner);

      await other.get(`/files/${fileId}`).expect(200);
    });

    it('404s on an id that does not exist', async () => {
      const agent = await registerUser(app, buildRegisterDto('file-missing'));

      await agent.get('/files/99999999').expect(404);
    });

    it('400s on a non-numeric id', async () => {
      const agent = await registerUser(app, buildRegisterDto('file-nan'));

      await agent.get('/files/not-a-number').expect(400);
    });
  });

  describe('DELETE /files/:id', () => {
    it('removes the file and clears the avatar reference in one step', async () => {
      const agent = await registerUser(app, buildRegisterDto('file-del'));
      const fileId = await uploadAvatar(agent);

      await agent.delete(`/files/${fileId}`).expect(200);

      await agent.get(`/files/${fileId}`).expect(404);
      const profile = (await agent.get('/users/me').expect(200))
        .body as apiResponse<UserMeResponse>;
      expect(profile.data!.avatarFileId).toBeNull();
    });

    it('refuses a non-owner and leaves the file retrievable', async () => {
      const owner = await registerUser(app, buildRegisterDto('file-del-own'));
      const other = await registerUser(app, buildRegisterDto('file-del-oth'));
      const fileId = await uploadAvatar(owner);

      await other.delete(`/files/${fileId}`).expect(403);

      await owner.get(`/files/${fileId}`).expect(200);
    });

    it('404s on an id that does not exist', async () => {
      const agent = await registerUser(app, buildRegisterDto('file-del-404'));

      await agent.delete('/files/99999999').expect(404);
    });

    it('rejects an unauthenticated request', async () => {
      const agent = await registerUser(app, buildRegisterDto('file-del-anon'));
      const fileId = await uploadAvatar(agent);

      await request(app.getHttpServer()).delete(`/files/${fileId}`).expect(401);
      await agent.get(`/files/${fileId}`).expect(200);
    });
  });
});

async function uploadAvatar(agent: TestAgent): Promise<number> {
  const response = await agent
    .post('/users/me/avatar')
    .attach('file', PNG_1X1, { filename: 'me.png', contentType: 'image/png' })
    .expect(201);
  return (response.body as apiResponse<UserMeResponse>).data!.avatarFileId!;
}

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
