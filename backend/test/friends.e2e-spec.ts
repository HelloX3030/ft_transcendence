import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { createTestApp } from './utils/create-test-app';
import { RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { register } from './utils';
import { FriendsResponse } from './types';
import { getUserId } from './utils/user.utils';

const bobRegister: RegisterDto = {
  username: 'bob',
  email: 'bob@example.com',
  password: 'Test123!',
  language: 'en',
};

const aliceRegister: RegisterDto = {
  username: 'alice',
  email: 'alice@example.com',
  password: 'Test123!',
  language: 'en',
};

const malloryRegister: RegisterDto = {
  username: 'mallory',
  email: 'mallory@example.com',
  password: 'Test123!',
  language: 'en',
};

describe('Friends (e2e)', () => {
  let app: INestApplication;

  let bobAgent: TestAgent;
  let aliceAgent: TestAgent;
  let malloryAgent: TestAgent;

  let bobId: number;
  let malloryId: number;

  beforeAll(async () => {
    app = await createTestApp();

    bobAgent = request.agent(app.getHttpServer());
    aliceAgent = request.agent(app.getHttpServer());
    malloryAgent = request.agent(app.getHttpServer());

    await register(bobAgent, bobRegister);
    await register(aliceAgent, aliceRegister);
    await register(malloryAgent, malloryRegister);

    bobId = await getUserId(bobAgent);
    malloryId = await getUserId(malloryAgent);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a friend request', async () => {
    await malloryAgent.post(`/friends/${bobId}`).expect(201);

    const response = await bobAgent.get('/friends').expect(200);

    const body = response.body as FriendsResponse;

    expect(body.friends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          friendId: malloryId,
          status: 'pending',
        }),
      ]),
    );
  });

  it('should accept a friend request', async () => {
    await bobAgent.patch(`/friends/${malloryId}/accept`).expect(200);

    const response = await bobAgent.get('/friends').expect(200);

    const body = response.body as FriendsResponse;

    expect(body.friends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          friendId: malloryId,
          status: 'accepted',
        }),
      ]),
    );
  });

  it('should delete an accepted friendship', async () => {
    await bobAgent.delete(`/friends/${malloryId}`).expect(200);

    const response = await bobAgent.get('/friends').expect(200);

    const body = response.body as FriendsResponse;

    expect(body.friends).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          friendId: malloryId,
        }),
      ]),
    );
  });

  it('should reject duplicate friend requests', async () => {
    await aliceAgent.post(`/friends/${bobId}`).expect(201);
    await aliceAgent.post(`/friends/${bobId}`).expect(409);
  });

  it('should not allow sending a friend request to yourself', async () => {
    await bobAgent.post(`/friends/${bobId}`).expect(400);
  });

  it('should not delete a friendship that not exist', async () => {
    await bobAgent.delete(`/friends/749274`).expect(404);
  });
});
