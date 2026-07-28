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
});
