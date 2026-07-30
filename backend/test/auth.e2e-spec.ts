import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { LoginDto, RegisterDto } from 'src/auth/dto';
import { checkCookies, createTestApp, login, logout, register } from './utils';
import { apiResponse } from '@trailertinder/shared';

const mockUserRegister: RegisterDto = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Test123!',
  language: 'en',
};

const mockUser: LoginDto = {
  email: 'test@example.com',
  password: 'Test123!',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register a new user', async () => {
    const agent = request.agent(app.getHttpServer());
    await register(agent, mockUserRegister);
  });

  it('Trying to register a user who is already registered', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Accept', 'application/json')
      .send(mockUserRegister)
      .expect('Content-Type', /json/)
      .expect(409);

    const body = response.body as apiResponse<null>;
    expect(body.message).toBe('Credentials taken');
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeUndefined();
  });

  it('refresh the token', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(agent, mockUser);

    const response = await agent.get('/auth/refresh').expect(200);
    checkCookies(response);
  });

  it('login and logout', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(agent, mockUser);
    await logout(agent);
  });

  it('marks both session cookies Secure when the request arrived over HTTPS', async () => {
    // In the running app the browser only ever reaches this service through
    // Caddy, which terminates TLS and forwards this header. Setting it here is
    // what the deployed request actually looks like — the plain-HTTP requests
    // the rest of this suite makes are an artefact of testing in-network.
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send(mockUser)
      .expect(200);

    const cookies = response.headers['set-cookie'];
    expect(cookies[0]).toContain('Secure');
    expect(cookies[1]).toContain('Secure');
  });
});
