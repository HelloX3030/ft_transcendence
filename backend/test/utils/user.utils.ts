import { expect } from '@jest/globals';
import { UserMeResponse } from 'test/types';
import TestAgent from 'supertest/lib/agent';

export async function getUserId(agent: TestAgent): Promise<number> {
  const body = (await agent.get('/users/me')).body as UserMeResponse;

  expect(body).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
    }),
  );

  return body.id;
}
