import { expect } from '@jest/globals';
import { LoginDto, RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { Response } from 'supertest';
import { ApiMsgResponse } from 'test/types';

export async function register(agent: TestAgent, user: RegisterDto) {
  const response = await agent
    .post('/auth/register')
    .set('Accept', 'application/json')
    .send(user)
    .expect('Content-Type', /json/)
    .expect(201);

  checkCookies(response);
  const body = response.body as ApiMsgResponse;
  expect(body.message).toBe('User registered successfully');
}

export async function login(agent: TestAgent, user: LoginDto) {
  const response = await agent
    .post('/auth/login')
    .set('Accept', 'application/json')
    .send(user)
    .expect('Content-Type', /json/)
    .expect(200);

  checkCookies(response);
  const body = response.body as ApiMsgResponse;
  expect(body.message).toBe('Login successful');
  return agent;
}

export async function logout(agent: TestAgent) {
  const responsLogout = await agent.get('/auth/logout').expect(200);
  const cookies = responsLogout.headers['set-cookie'];
  expect(cookies[0]).toBe('access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  expect(cookies[1]).toBe('refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
}

export function checkCookies(response: Response) {
  const cookies = response.headers['set-cookie'];
  expect(cookies[0]).toContain('access_token=');
  expect(cookies[1]).toContain('refresh_token=');
}
