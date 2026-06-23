import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { createTestApp } from './utils/create-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/ping returns pong and a valid db_time', async () => {
    const response = await request(app.getHttpServer()).get('/api/ping').expect(200);
    const body = response.body as { message: string; db_time: string };

    expect(body.message).toBe('pong');
    expect(typeof body.db_time).toBe('string');
    expect(new Date(body.db_time).getTime()).not.toBeNaN();
  });
});
