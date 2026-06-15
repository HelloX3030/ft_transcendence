import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { LoginDto, RegisterDto } from 'src/auth/dto';
import cookieParser from 'cookie-parser';
import TestAgent from 'supertest/lib/agent';

const mockRegisterDto: RegisterDto = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Test123!',
  language: 'en',
};

const mockLoginDto: LoginDto = {
  email: 'test@example.com',
  password: 'Test123!',
};

interface ApiResponse {
  message: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        // transform: true, todo: may be necessary later to convert the data types automatically
      }),
    );
    app.enableCors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    });
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register a new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Accept', 'application/json')
      .send(mockRegisterDto)
      .expect('Content-Type', /json/)
      .expect(201);

    const body = response.body as ApiResponse;
    expect(body.message).toBe('User registered successfully');
    checkCookies(response);
  });

  it('Trying to register a user who is already registered', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Accept', 'application/json')
      .send(mockRegisterDto)
      .expect('Content-Type', /json/)
      .expect(403);

    const body = response.body as ApiResponse;
    expect(body.message).toBe('Credentials taken');
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeUndefined();
  });

  it('refresh the token', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(agent);

    const response = await agent.get('/auth/refresh').expect(200);
    checkCookies(response);
  });

  it('login and logout', async () => {
    const agent = request.agent(app.getHttpServer());
    await login(agent);
    await logout(agent);
  });

  async function login(agent: TestAgent) {
    const response = await agent
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send(mockLoginDto)
      .expect('Content-Type', /json/)
      .expect(200);

    checkCookies(response);
    const body = response.body as ApiResponse;
    expect(body.message).toBe('Login successful');
    return agent;
  }

  async function logout(agent: TestAgent) {
    const responsLogout = await agent.get('/auth/logout').expect(200);
    const cookies = responsLogout.headers['set-cookie'];
    expect(cookies[0]).toBe('access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect(cookies[1]).toBe('refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }
});

function checkCookies(response: Response) {
  const cookies = response.headers['set-cookie'];
  expect(cookies[0]).toContain('access_token=');
  expect(cookies[1]).toContain('refresh_token=');
}
