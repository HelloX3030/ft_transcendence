import { expect } from '@jest/globals';
import { LoginDto, RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { Response } from 'supertest';
import { apiResponse } from '@cinemates/shared';

export async function register(agent: TestAgent, user: RegisterDto) {
  const response = await agent
    .post('/auth/register')
    .set('Accept', 'application/json')
    .send(user)
    .expect('Content-Type', /json/)
    .expect(201);

  checkCookies(response);
  const body = response.body as apiResponse<null>;
  expect(body.message).toBe('User registered successfully');

  // Returned so a caller can keep the cookies this response set, which an agent
  // would overwrite on the next request.
  return response;
}

export async function login(agent: TestAgent, user: LoginDto) {
  const response = await agent
    .post('/auth/login')
    .set('Accept', 'application/json')
    .send(user)
    .expect('Content-Type', /json/)
    .expect(200);

  checkCookies(response);
  const body = response.body as apiResponse<null>;
  expect(body.message).toBe('Login successful');
  return agent;
}

export async function logout(agent: TestAgent) {
  const responsLogout = await agent.post('/auth/logout').expect(200);
  const cookies = responsLogout.headers['set-cookie'];
  // The clearing cookies carry the same attributes as the ones that set them:
  // Express only clears a cookie when the options match.
  expect(cookies[0]).toBe(
    'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict',
  );
  expect(cookies[1]).toBe(
    'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict',
  );
}

export function checkCookies(response: Response) {
  const cookies = response.headers['set-cookie'];
  expect(cookies[0]).toContain('access_token=');
  expect(cookies[1]).toContain('refresh_token=');
  expect(cookies[0]).toContain('HttpOnly');
  expect(cookies[1]).toContain('HttpOnly');
  expect(cookies[0]).toContain('SameSite=Strict');
  expect(cookies[1]).toContain('SameSite=Strict');
}

/**
 * Supertest assertion for a user-input failure: routes marked ExpectedUserErrors
 * answer 200 so Chrome logs nothing, and the real status travels in the body.
 */
export const userError = (status: number) => (res: { status: number; body: unknown }) => {
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: false, statusCode: status });
};
