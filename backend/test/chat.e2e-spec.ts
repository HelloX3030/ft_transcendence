import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChatService } from 'src/chat/chat.service';
import { createTestApp, getUserId, register } from './utils';
import { apiResponse, ChatConversation, ChatMessage, ChatMessagePage } from '@cinemates/shared';

function user(name: string): RegisterDto {
  return {
    username: name,
    email: `${name}@example.com`,
    password: 'Test123!',
    language: 'en',
  };
}

describe('Chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let chat: ChatService;

  let camAgent: TestAgent;
  let cloAgent: TestAgent;
  let carlAgent: TestAgent;

  let camId: number;
  let cloId: number;
  let carlId: number;

  /**
   * Sending is a socket handler, and these tests deliberately open no socket —
   * every recipient is offline throughout, which is the case the spec is about.
   * The service is the seam the gateway delegates to, so calling it directly
   * exercises the whole persistence and authorisation path.
   */
  async function send(senderId: number, peerUserId: number, msg: string) {
    return chat.send(senderId, { peerUserId, msg, clientMsgId: `c-${Date.now()}-${msg}` });
  }

  async function history(agent: TestAgent, peerId: number, query = ''): Promise<ChatMessagePage> {
    const response = await agent.get(`/chat/${peerId}/messages${query}`).expect(200);
    return (response.body as apiResponse<ChatMessagePage>).data!;
  }

  async function conversations(agent: TestAgent): Promise<ChatConversation[]> {
    const response = await agent.get('/chat/conversations').expect(200);
    return (response.body as apiResponse<ChatConversation[]>).data!;
  }

  async function befriend(a: TestAgent, aId: number, b: TestAgent, bId: number) {
    await a.post(`/friends/${bId}`).expect(201);
    await b.patch(`/friends/${aId}/accept`).expect(200);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    chat = app.get(ChatService);

    camAgent = request.agent(app.getHttpServer());
    cloAgent = request.agent(app.getHttpServer());
    carlAgent = request.agent(app.getHttpServer());

    await register(camAgent, user('cam'));
    await register(cloAgent, user('clo'));
    await register(carlAgent, user('carl'));

    camId = await getUserId(camAgent);
    cloId = await getUserId(cloAgent);
    carlId = await getUserId(carlAgent);

    await befriend(camAgent, camId, cloAgent, cloId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers messages sent while the recipient was never connected', async () => {
    await send(camId, cloId, 'one');
    await send(camId, cloId, 'two');
    await send(camId, cloId, 'three');

    const page = await history(cloAgent, camId);

    expect(page.messages.map(({ body }) => body)).toEqual(['one', 'two', 'three']);
    expect(page.messages.every(({ readAt }) => readAt === null)).toBe(true);

    const [conversation] = (await conversations(cloAgent)).filter((c) => c.peerUserId === camId);
    expect(conversation.unreadCount).toBe(3);
    expect(conversation.lastMessage?.body).toBe('three');
  });

  it('serves the same transcript to both parties, so a reload loses nothing', async () => {
    const mine = await history(camAgent, cloId);
    const theirs = await history(cloAgent, camId);

    expect(mine.messages.map(({ id }) => id)).toEqual(theirs.messages.map(({ id }) => id));
    // `peerUserId` is "the other party", so it differs per reader.
    expect(mine.messages[0].peerUserId).toBe(cloId);
    expect(theirs.messages[0].peerUserId).toBe(camId);
  });

  it('clears the unread count on read and leaves the sender unaffected', async () => {
    await cloAgent.post(`/chat/${camId}/read`).expect(200);

    const [conversation] = (await conversations(cloAgent)).filter((c) => c.peerUserId === camId);
    expect(conversation.unreadCount).toBe(0);

    // Marking read must not touch the reader's own outgoing messages.
    await send(cloId, camId, 'reply');
    const [forCam] = (await conversations(camAgent)).filter((c) => c.peerUserId === cloId);
    expect(forCam.unreadCount).toBe(1);
  });

  describe('pagination', () => {
    let peerId: number;
    let peerAgent: TestAgent;

    beforeAll(async () => {
      peerAgent = request.agent(app.getHttpServer());
      await register(peerAgent, user('pagey'));
      peerId = await getUserId(peerAgent);
      await befriend(carlAgent, carlId, peerAgent, peerId);

      for (let i = 0; i < 75; i++) {
        await send(carlId, peerId, `msg-${i}`);
      }
    });

    it('walks every message exactly once', async () => {
      const seen: ChatMessage[] = [];
      let cursor: string | null = null;
      do {
        const page: ChatMessagePage = await history(
          carlAgent,
          peerId,
          `?limit=30${cursor === null ? '' : `&before=${cursor}`}`,
        );
        // Pages arrive newest-block-first but ascending within the block.
        seen.unshift(...page.messages);
        cursor = page.nextCursor;
      } while (cursor !== null);

      const ids = seen.map(({ id }) => id);
      expect(ids).toHaveLength(75);
      expect(new Set(ids).size).toBe(75);
      expect(seen.map(({ body }) => body)).toEqual(
        Array.from({ length: 75 }, (_, i) => `msg-${i}`),
      );
    });

    it('neither duplicates nor skips when a message arrives between pages', async () => {
      const first = await history(carlAgent, peerId, '?limit=30');

      // The insert that breaks LIMIT/OFFSET: every row shifts by one.
      await send(carlId, peerId, 'interleaved');

      const second = await history(carlAgent, peerId, `?limit=30&before=${first.nextCursor}`);

      const firstIds = new Set(first.messages.map(({ id }) => id));
      const overlap = second.messages.filter(({ id }) => firstIds.has(id));
      expect(overlap).toHaveLength(0);

      // And nothing fell through the gap: the two pages are contiguous.
      const oldestOfFirst = Math.min(...first.messages.map(({ id }) => id));
      const newestOfSecond = Math.max(...second.messages.map(({ id }) => id));
      expect(newestOfSecond).toBe(oldestOfFirst - 1);
    });

    it('rejects a malformed cursor with 400, not 500', async () => {
      await carlAgent.get(`/chat/${peerId}/messages?before=nope`).expect(400);
    });

    it('rejects a limit outside the allowed range', async () => {
      await carlAgent.get(`/chat/${peerId}/messages?limit=0`).expect(400);
      await carlAgent.get(`/chat/${peerId}/messages?limit=101`).expect(400);
    });
  });

  describe('send authorisation', () => {
    async function countMessages(aId: number, bId: number) {
      const [userAId, userBId] = aId < bId ? [aId, bId] : [bId, aId];
      return prisma.messages.count({ where: { userAId, userBId } });
    }

    it('rejects a send between users who were never friends, persisting nothing', async () => {
      const before = await countMessages(camId, carlId);

      await expect(send(camId, carlId, 'hi')).rejects.toThrow();

      expect(await countMessages(camId, carlId)).toBe(before);
    });

    it('rejects a send while the friendship is still pending', async () => {
      const pendingAgent = request.agent(app.getHttpServer());
      await register(pendingAgent, user('pending'));
      const pendingId = await getUserId(pendingAgent);
      await camAgent.post(`/friends/${pendingId}`).expect(201);

      await expect(send(camId, pendingId, 'hi')).rejects.toThrow();

      expect(await countMessages(camId, pendingId)).toBe(0);
    });

    it('rejects a send after being unfriended, even with a stale window open', async () => {
      const exAgent = request.agent(app.getHttpServer());
      await register(exAgent, user('exfriend'));
      const exId = await getUserId(exAgent);
      await befriend(camAgent, camId, exAgent, exId);
      await send(camId, exId, 'while friends');

      await exAgent.delete(`/friends/${camId}`).expect(200);

      await expect(send(camId, exId, 'after')).rejects.toThrow();
      expect(await countMessages(camId, exId)).toBe(1);
    });

    it('rejects a send to yourself', async () => {
      await expect(send(camId, camId, 'note to self')).rejects.toThrow();
      expect(await countMessages(camId, camId)).toBe(0);
    });

    it('rejects a send to a deleted account', async () => {
      const doomedAgent = request.agent(app.getHttpServer());
      await register(doomedAgent, user('doomed'));
      const doomedId = await getUserId(doomedAgent);
      await befriend(camAgent, camId, doomedAgent, doomedId);

      await doomedAgent.delete('/users/me').expect(200);

      await expect(send(camId, doomedId, 'anyone there')).rejects.toThrow();
    });

    it('rejects an empty, whitespace-only or over-long body', async () => {
      await expect(send(camId, cloId, '')).rejects.toThrow();
      await expect(send(camId, cloId, '   ')).rejects.toThrow();
      await expect(send(camId, cloId, 'a'.repeat(2001))).rejects.toThrow();
    });
  });

  describe('unfriending', () => {
    let exAgent: TestAgent;
    let exId: number;

    beforeAll(async () => {
      exAgent = request.agent(app.getHttpServer());
      await register(exAgent, user('rekindle'));
      exId = await getUserId(exAgent);
      await befriend(camAgent, camId, exAgent, exId);
      await send(camId, exId, 'first');
      await send(exId, camId, 'second');
    });

    it('destroys no messages', async () => {
      await camAgent.delete(`/friends/${exId}`).expect(200);

      const page = await history(camAgent, exId);
      expect(page.messages.map(({ body }) => body)).toEqual(['first', 'second']);
    });

    it('lets an ex-friend still read their own preserved history', async () => {
      const page = await history(exAgent, camId);

      expect(page.messages).toHaveLength(2);
    });

    it('drops the conversation from the friend-derived list while it lasts', async () => {
      const list = await conversations(camAgent);

      expect(list.map(({ peerUserId }) => peerUserId)).not.toContain(exId);
    });

    it('restores the conversation with its history once they are friends again', async () => {
      await befriend(camAgent, camId, exAgent, exId);

      const [conversation] = (await conversations(camAgent)).filter((c) => c.peerUserId === exId);
      expect(conversation.lastMessage?.body).toBe('second');
      expect((await history(camAgent, exId)).messages).toHaveLength(2);
    });
  });

  describe('read authorisation', () => {
    it('never exposes a conversation a third party is not part of', async () => {
      // `/chat/:peerId/messages` addresses the caller's own conversation with
      // `peerId`, so carl asking about cam gets carl↔cam — empty — not cam↔clo.
      const page = await history(carlAgent, camId);

      expect(page.messages).toHaveLength(0);
      const camCloBodies = (await history(camAgent, cloId)).messages.map(({ body }) => body);
      expect(camCloBodies.length).toBeGreaterThan(0);
    });

    it('requires authentication', async () => {
      const anonymous = request.agent(app.getHttpServer());

      await anonymous.get('/chat/conversations').expect(401);
      await anonymous.get(`/chat/${camId}/messages`).expect(401);
      await anonymous.post(`/chat/${camId}/read`).expect(401);
    });
  });

  it('returns an empty conversation cleanly', async () => {
    const freshAgent = request.agent(app.getHttpServer());
    await register(freshAgent, user('fresh'));
    const freshId = await getUserId(freshAgent);
    await befriend(camAgent, camId, freshAgent, freshId);

    const page = await history(camAgent, freshId);

    expect(page.messages).toEqual([]);
    expect(page.nextCursor).toBeNull();

    const [conversation] = (await conversations(camAgent)).filter((c) => c.peerUserId === freshId);
    expect(conversation.lastMessage).toBeNull();
    expect(conversation.unreadCount).toBe(0);
  });
});
