import { expect } from '@jest/globals';
import TestAgent from 'supertest/lib/agent';
import { UserMeResponse } from '@trailertinder/shared';

export async function getUserId(agent: TestAgent): Promise<number> {
  const body = (await agent.get('/users/me')).body as UserMeResponse;

  expect(body).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
    }),
  );

  return body.id;
}
