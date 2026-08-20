import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { RegisterDto } from 'src/auth/dto';
import TestAgent from 'supertest/lib/agent';
import { createTestApp, getUserId, register } from './utils';
import { apiResponse, NotificationItem, NotificationPage } from '@cinemates/shared';

const ninaRegister: RegisterDto = {
  username: 'nina',
  email: 'nina@example.com',
  password: 'Test123!',
};

const noraRegister: RegisterDto = {
  username: 'nora',
  email: 'nora@example.com',
  password: 'Test123!',
};

const nedRegister: RegisterDto = {
  username: 'ned',
  email: 'ned@example.com',
  password: 'Test123!',
};

async function inbox(agent: TestAgent, query = ''): Promise<NotificationPage> {
  const response = await agent.get(`/notifications${query}`).expect(200);
  const body = response.body as apiResponse<NotificationPage>;
  return body.data!;
}

async function unreadCount(agent: TestAgent): Promise<number> {
  const response = await agent.get('/notifications/unread-count').expect(200);
  const body = response.body as apiResponse<{ unreadCount: number }>;
  return body.data!.unreadCount;
}

/**
 * Each request/cancel cycle leaves the peer two notifications. Used to seed
 * enough rows to walk several pages.
 */
async function requestAndCancel(agent: TestAgent, peerId: number) {
  await agent.post(`/friends/${peerId}`).expect(201);
  await agent.delete(`/friends/${peerId}`).expect(200);
}

describe('Notifications (e2e)', () => {
  let app: INestApplication;

  let ninaAgent: TestAgent;
  let noraAgent: TestAgent;
  let nedAgent: TestAgent;

  let ninaId: number;
  let noraId: number;

  beforeAll(async () => {
    app = await createTestApp();

    ninaAgent = request.agent(app.getHttpServer());
    noraAgent = request.agent(app.getHttpServer());
    nedAgent = request.agent(app.getHttpServer());

    await register(ninaAgent, ninaRegister);
    await register(noraAgent, noraRegister);
    await register(nedAgent, nedRegister);

    ninaId = await getUserId(ninaAgent);
    noraId = await getUserId(noraAgent);
    await getUserId(nedAgent);
  });

  afterAll(async () => {
    await app.close();
  });

  it('persists a notification raised while the recipient has no socket open', async () => {
    // No websocket is ever opened in this suite, so nora is offline throughout,
    // which is exactly the case a presence-gated write would drop.
    await ninaAgent.post(`/friends/${noraId}`).expect(201);

    const page = await inbox(noraAgent);

    expect(page.notifications).toEqual([
      expect.objectContaining({
        type: 'friend.request.created',
        actorId: ninaId,
        params: { actorUsername: 'nina' },
        readAt: null,
      }),
    ]);
    expect(page.unreadCount).toBe(1);
  });

  it('stores the event type and a params snapshot, never a rendered sentence', async () => {
    const page = await inbox(noraAgent);
    const [notification] = page.notifications;

    expect(Object.values(notification.params)).not.toContainEqual(
      expect.stringContaining('friend request'),
    );
    expect(notification.type).toBe('friend.request.created');
  });

  it('distinguishes accept from the other delete semantics', async () => {
    await noraAgent.patch(`/friends/${ninaId}/accept`).expect(200);

    const page = await inbox(ninaAgent);

    expect(page.notifications[0]).toEqual(
      expect.objectContaining({
        type: 'friend.request.accepted',
        actorId: noraId,
        params: { actorUsername: 'nora' },
      }),
    );
  });

  it('records an unfriend as friend.removed for the other party', async () => {
    await noraAgent.delete(`/friends/${ninaId}`).expect(200);

    const page = await inbox(ninaAgent);

    expect(page.notifications[0]).toEqual(
      expect.objectContaining({ type: 'friend.removed', actorId: noraId }),
    );
  });

  it('tracks the unread count across read, read-all and delete', async () => {
    await ninaAgent.delete('/notifications').expect(200);
    await requestAndCancel(noraAgent, ninaId);
    expect(await unreadCount(ninaAgent)).toBe(2);

    const page = await inbox(ninaAgent);
    await ninaAgent.patch(`/notifications/${page.notifications[0].id}/read`).expect(200);
    expect(await unreadCount(ninaAgent)).toBe(1);

    // Deleting the remaining unread row must take it out of the count too.
    await ninaAgent.delete(`/notifications/${page.notifications[1].id}`).expect(200);
    expect(await unreadCount(ninaAgent)).toBe(0);

    await requestAndCancel(noraAgent, ninaId);
    expect(await unreadCount(ninaAgent)).toBe(2);

    await ninaAgent.post('/notifications/read-all').expect(200);
    expect(await unreadCount(ninaAgent)).toBe(0);
  });

  it('filters to unread rows on request', async () => {
    await ninaAgent.delete('/notifications').expect(200);
    await requestAndCancel(noraAgent, ninaId);
    const page = await inbox(ninaAgent);
    await ninaAgent.patch(`/notifications/${page.notifications[0].id}/read`).expect(200);

    const unread = await inbox(ninaAgent, '?unreadOnly=true');

    expect(unread.notifications).toHaveLength(1);
    expect(unread.notifications[0].readAt).toBeNull();
  });

  it('walks pages that neither overlap nor skip', async () => {
    await ninaAgent.delete('/notifications').expect(200);
    // 13 cycles → 26 rows, i.e. several full pages plus a short last one.
    for (let i = 0; i < 13; i++) {
      await requestAndCancel(noraAgent, ninaId);
    }

    const seen: NotificationItem[] = [];
    let cursor: string | null = null;
    do {
      const page: NotificationPage = await inbox(
        ninaAgent,
        `?limit=10${cursor === null ? '' : `&cursor=${cursor}`}`,
      );
      seen.push(...page.notifications);
      cursor = page.nextCursor;
    } while (cursor !== null);

    const ids = seen.map(({ id }) => id);
    expect(ids).toHaveLength(26);
    expect(new Set(ids).size).toBe(26);
    // Newest first, strictly descending, the ordering the cursor relies on.
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  });

  it('rejects a malformed cursor with 400, not 500', async () => {
    await ninaAgent.get('/notifications?cursor=not-a-cursor').expect(400);
  });

  it('rejects a limit outside the allowed range', async () => {
    await ninaAgent.get('/notifications?limit=0').expect(400);
    await ninaAgent.get('/notifications?limit=101').expect(400);
  });

  it("never serves another user's notifications", async () => {
    const ninaPage = await inbox(ninaAgent);
    const nedPage = await inbox(nedAgent);

    expect(ninaPage.notifications.length).toBeGreaterThan(0);
    expect(nedPage.notifications).toHaveLength(0);
  });

  it("cannot mark or delete another user's notification", async () => {
    const page = await inbox(ninaAgent);
    const id = page.notifications[0].id;

    await nedAgent.patch(`/notifications/${id}/read`).expect(404);
    await nedAgent.delete(`/notifications/${id}`).expect(404);

    // Untouched for the owner.
    const after = await inbox(ninaAgent);
    expect(after.notifications[0].id).toBe(id);
    expect(after.notifications[0].readAt).toBeNull();
  });

  it("clearing one inbox leaves the other user's alone", async () => {
    await requestAndCancel(ninaAgent, await getUserId(nedAgent));
    expect((await inbox(nedAgent)).notifications.length).toBeGreaterThan(0);

    await ninaAgent.delete('/notifications').expect(200);

    expect((await inbox(ninaAgent)).notifications).toHaveLength(0);
    expect((await inbox(nedAgent)).notifications.length).toBeGreaterThan(0);
  });

  it('requires authentication', async () => {
    const anonymous = request.agent(app.getHttpServer());

    await anonymous.get('/notifications').expect(401);
    await anonymous.get('/notifications/unread-count').expect(401);
    await anonymous.delete('/notifications').expect(401);
  });
});
