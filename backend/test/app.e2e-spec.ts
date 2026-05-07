import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/ping returns pong and a valid db_time', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/ping')
      .expect(200);

    expect(response.body.message).toBe('pong');
    expect(typeof response.body.db_time).toBe('string');
    expect(new Date(response.body.db_time).getTime()).not.toBeNaN();
  });
});
