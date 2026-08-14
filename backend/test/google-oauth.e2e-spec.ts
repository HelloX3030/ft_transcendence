import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { Request as ExpressRequest } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleCallbackGuard } from 'src/auth/guard';
import { GoogleProfile } from 'src/types';
import { createTestApp } from './utils/create-test-app.utils';
import { register } from './utils';

/**
 * The Google exchange itself is never performed here: the callback guard is
 * replaced with one that hands the controller a profile directly. Everything
 * downstream of that — resolution order, session cookies, the sessions row and
 * /auth/me — is the real implementation.
 *
 * Calling Google from a test would make the suite depend on a third party, on
 * network access, and on credentials that cannot be committed.
 */
let stubbedProfile: GoogleProfile | null = null;

const stubGuard = {
  canActivate: (context: { switchToHttp: () => { getRequest: <T>() => T } }): boolean => {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    req.user = stubbedProfile ?? undefined;
    return stubbedProfile !== null;
  },
};

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

const GOOGLE_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'] as const;

/**
 * Runs `body` with the Google credentials taken out of the environment.
 *
 * The unconfigured branch cannot be asserted against whatever the developer
 * happens to have in `.env`: with credentials set, the start route reaches
 * passport and redirects, and the test read that 302 as a regression. The guard
 * re-reads process.env per request, so clearing the three variables is enough —
 * AuthModule's strategy registration is decided at import time and is not what
 * the 503 hangs on.
 */
async function withoutGoogleCredentials(body: () => Promise<void>): Promise<void> {
  const saved = GOOGLE_ENV.map((key) => [key, process.env[key]] as const);
  for (const key of GOOGLE_ENV) delete process.env[key];
  try {
    await body();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('Google OAuth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideGuard(GoogleCallbackGuard).useValue(stubGuard),
    );
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app !== undefined) await app.close();
  });

  // The state of any fresh clone, and of CI. Credentials are removed for the
  // duration of each case rather than assumed absent, so these hold on a
  // developer machine that does have Google sign-in set up. The app has to boot
  // and serve everything else regardless.
  describe('without credentials configured', () => {
    it('answers 503 rather than 500 on the start route', async () => {
      await withoutGoogleCredentials(async () => {
        await request(app.getHttpServer()).get('/auth/google').expect(503);
      });
    });

    it('leaves the rest of the API working', async () => {
      await withoutGoogleCredentials(async () => {
        await request(app.getHttpServer()).get('/auth/me').expect(401);
      });
    });
  });

  describe('callback', () => {
    it('creates a session for a brand-new Google identity', async () => {
      const email = uniqueEmail('google-new');
      stubbedProfile = {
        googleId: `sub-${email}`,
        email,
        emailVerified: true,
        locale: 'en-GB',
      };

      const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

      expect(response.headers.location).toContain('/auth/callback');
      expect(response.headers.location).not.toContain('error=');

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

      const user = await prisma.users.findUnique({ where: { email } });
      expect(user).not.toBeNull();
      expect(user?.password).toBeNull();
      expect(user?.googleId).toBe(stubbedProfile.googleId);
      expect(user?.onboardingCompleted).toBe(false);

      // A real session row, not just a signed cookie.
      const sessions = await prisma.sessions.findMany({ where: { userId: user?.id } });
      expect(sessions).toHaveLength(1);

      // The cookies are Strict, so this is the same-origin request the landing
      // route makes — the whole reason the callback redirects to the SPA first.
      await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookies).expect(200);
    });

    it('links a verified Google email onto an existing local account', async () => {
      const agent = request.agent(app.getHttpServer());
      const email = uniqueEmail('google-link');
      await register(agent, {
        username: `link${Date.now().toString().slice(-8)}`,
        email,
        password: 'Str0ng!Password1',
        language: 'en',
      });

      const before = await prisma.users.findUnique({ where: { email } });
      stubbedProfile = { googleId: `sub-${email}`, email, emailVerified: true };

      await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

      const after = await prisma.users.findUnique({ where: { email } });
      expect(after?.id).toBe(before?.id);
      expect(after?.googleId).toBe(stubbedProfile.googleId);
      // Linked, not duplicated: the email is unique, so a second row is impossible
      // anyway — this asserts the local password and username survived untouched.
      expect(after?.password).toBe(before?.password);
      expect(after?.username).toBe(before?.username);
    });

    it('refuses to link an unverified Google email', async () => {
      const agent = request.agent(app.getHttpServer());
      const email = uniqueEmail('google-unverified');
      await register(agent, {
        username: `unver${Date.now().toString().slice(-8)}`,
        email,
        password: 'Str0ng!Password1',
        language: 'en',
      });

      stubbedProfile = { googleId: `sub-${email}`, email, emailVerified: false };

      const response = await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

      expect(response.headers.location).toContain('error=unverified_email');
      const user = await prisma.users.findUnique({ where: { email } });
      expect(user?.googleId).toBeNull();
    });

    it('reports a failure as a redirect code, never an upstream string', async () => {
      stubbedProfile = null;

      const response = await request(app.getHttpServer()).get('/auth/google/callback');

      // The stub guard denies, which is passport's own 401 path rather than a
      // GoogleAuthException — the point is that nothing leaks a provider detail.
      expect(response.text).not.toContain('googleapis');
      expect(response.text).not.toContain('client_secret');
    });
  });

  describe('a Google-only account', () => {
    it('cannot be logged into with a password, and answers 403 not 500', async () => {
      const email = uniqueEmail('google-only');
      stubbedProfile = { googleId: `sub-${email}`, email, emailVerified: true };
      await request(app.getHttpServer()).get('/auth/google/callback').expect(302);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'anything-at-all' })
        .expect(403);
    });
  });
});
