import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { LoginDto, RegisterDto } from 'src/auth/dto';
import { checkCookies, createTestApp, getUserId, login, logout, register } from './utils';
import { apiResponse } from '@cinemates/shared';
import { PrismaService } from 'src/prisma/prisma.service';

const mockUserRegister: RegisterDto = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Test123!',
};

const mockUser: LoginDto = {
  email: 'test@example.com',
  password: 'Test123!',
};

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
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

  // GET /auth/me is a question, not a demand: it exists so the client can ask
  // whether it has a session. Answering "no" with a 401 made every logged-out
  // page load print a console error the client could handle but not unprint.
  describe('session probe', () => {
    it('answers 200 to a caller with no cookies', async () => {
      const response = await request(app.getHttpServer()).get('/auth/me').expect(200);

      expect(response.body).toMatchObject({ data: { authenticated: false } });
    });

    it('answers with the token payload once signed in', async () => {
      const agent = request.agent(app.getHttpServer());
      await login(agent, mockUser);

      const response = await agent.get('/auth/me').expect(200);
      const body = (
        response.body as { data: { authenticated: boolean; sub: number; email: string } }
      ).data;

      expect(body.authenticated).toBe(true);
      expect(typeof body.sub).toBe('number');
      expect(body.email).toBe(mockUser.email);
    });

    it('does not open up the endpoints that serve the profile itself', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });
  });

  it('marks both session cookies Secure when the request arrived over HTTPS', async () => {
    // In the running app the browser only ever reaches this service through
    // Caddy, which terminates TLS and forwards this header. Setting it here is
    // what the deployed request actually looks like, the plain-HTTP requests
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

  describe('refresh token rotation', () => {
    // These drive the cookie by hand rather than through an agent: the whole
    // point is replaying a superseded cookie, which an agent would have
    // overwritten with the fresh one.
    it('refuses a refresh token that has already been used', async () => {
      const { registration, userId } = await freshUser('rotate-replay');
      const original = refreshCookie(registration);

      // Spends `original`, which rotates the session key.
      await request(app.getHttpServer()).get('/auth/refresh').set('Cookie', original).expect(200);

      // Stands in for the grace window elapsing. Sleeping it out would add 30
      // seconds to the suite to test a threshold the unit tests already cover.
      await prisma.sessions.updateMany({
        where: { userId },
        data: { rotatedAt: new Date(Date.now() - 60_000) },
      });

      await request(app.getHttpServer()).get('/auth/refresh').set('Cookie', original).expect(403);
    });

    it('accepts the rotated token, so the happy path still works', async () => {
      const { registration } = await freshUser('rotate-happy');

      const rotated = await request(app.getHttpServer())
        .get('/auth/refresh')
        .set('Cookie', refreshCookie(registration))
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/refresh')
        .set('Cookie', refreshCookie(rotated))
        .expect(200);
    });

    // The multi-tab race. Two tabs share a cookie but coalesce their in-flight
    // refresh only within themselves, so both can legitimately present the same
    // key, and neither may be logged out for it.
    it('answers two refreshes on the same token back to back', async () => {
      const { registration } = await freshUser('rotate-race');
      const shared = refreshCookie(registration);

      const [a, b] = await Promise.all([
        request(app.getHttpServer()).get('/auth/refresh').set('Cookie', shared),
        request(app.getHttpServer()).get('/auth/refresh').set('Cookie', shared),
      ]);

      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      // Both tabs end up writing the same cookie, so whichever response lands
      // last leaves a key that is still current.
      expect(refreshCookie(a)).toBe(refreshCookie(b));
    });

    // `delete` on a missing row throws P2025, which the Prisma filter turned
    // into a 404, reachable whenever the session was swept, another tab logged
    // out, or the request was simply retried.
    it('logs out twice without a 404', async () => {
      const { registration } = await freshUser('rotate-logout');
      // Replayed by hand: logging out clears the cookie, so an agent would send
      // nothing the second time and be turned away by the guard at 401, never
      // reaching the delete this is about.
      const cookie = refreshCookie(registration);

      await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(200);
      await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(200);
    });
  });

  /** The `refresh_token=<value>` pair from a response's Set-Cookie header. */
  function refreshCookie(response: request.Response): string {
    const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
    const hit = raw?.find((cookie) => cookie.startsWith('refresh_token='));
    expect(hit).toBeDefined();
    return hit!.split(';')[0];
  }

  async function freshUser(prefix: string) {
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const dto: RegisterDto = {
      username: `${prefix}-${token}`.slice(0, 32),
      email: `${prefix}-${token}@example.com`,
      password: 'Test123!',
    };

    const agent = request.agent(app.getHttpServer());
    const registration = await register(agent, dto);

    return { agent, registration, userId: await getUserId(agent) };
  }
});
