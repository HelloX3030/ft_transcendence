import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { createTestApp } from './utils/create-test-app.utils';
import { login, register } from './utils';

/**
 * The mailer is replaced rather than pointed at Mailpit: the reset token exists
 * only in the mail body, so capturing the send is how the test gets hold of it —
 * exactly the path a real user takes, minus SMTP.
 */
const sentMail: { to: string; subject: string; body: string }[] = [];

const mailStub = {
  send: () => Promise.resolve(),
  sendInBackground: (to: string, subject: string, body: string) => {
    sentMail.push({ to, subject, body });
  },
};

function tokenFromLastMail(): string {
  const body = sentMail[sentMail.length - 1]?.body ?? '';
  const token = /token=([^\s]+)/.exec(body)?.[1];
  if (token === undefined) throw new Error('No reset token in the captured mail');
  return token;
}

function credentials(prefix: string) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9);
  return {
    username: `${prefix}${unique}`.slice(0, 32),
    email: `${prefix}-${unique}@example.com`,
    password: 'Str0ng!Password1',
  };
}

describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(MailService).useValue(mailStub),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    sentMail.length = 0;
  });

  afterAll(async () => {
    if (app !== undefined) await app.close();
  });

  it('answers the same for a known and an unknown address', async () => {
    const user = credentials('known');
    await register(request.agent(app.getHttpServer()), user);

    const known = await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: user.email })
      .expect(200);

    const unknown = await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: 'nobody-at-all@example.com' })
      .expect(200);

    expect(known.body).toEqual(unknown.body);
  });

  it('completes a reset, kills existing sessions and rejects the old password', async () => {
    const user = credentials('reset');
    const agent: TestAgent = request.agent(app.getHttpServer());
    await register(agent, user);

    const before = await prisma.users.findUnique({ where: { email: user.email } });
    expect(await prisma.sessions.count({ where: { userId: before?.id } })).toBe(1);

    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: user.email })
      .expect(200);

    const newPassword = 'An0ther!Password';
    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token: tokenFromLastMail(), password: newPassword })
      .expect(200);

    // The security payload: the session that existed before the reset is gone,
    // so whoever caused the reset is evicted along with the password.
    expect(await prisma.sessions.count({ where: { userId: before?.id } })).toBe(0);
    await agent.get('/auth/refresh').expect(403);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(403);

    await login(request.agent(app.getHttpServer()), {
      email: user.email,
      password: newPassword,
    });
  });

  it('refuses to spend the same link twice', async () => {
    const user = credentials('once');
    await register(request.agent(app.getHttpServer()), user);

    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: user.email })
      .expect(200);
    const token = tokenFromLastMail();

    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token, password: 'An0ther!Password' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token, password: 'AThird!Password9' })
      .expect(400);
  });

  it('rejects an unknown token exactly like a used one', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token: 'not-a-real-token', password: 'An0ther!Password' })
      .expect(400);

    expect(JSON.stringify(response.body)).toContain('invalid or has expired');
  });

  it('rejects a weak password with the same rule as registration', async () => {
    const user = credentials('weak');
    await register(request.agent(app.getHttpServer()), user);

    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: user.email })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/password/reset')
      .send({ token: tokenFromLastMail(), password: 'weak' })
      .expect(400);
  });

  it('sends a Google notice instead of a reset link for a password-less account', async () => {
    const email = `google-only-${Date.now()}@example.com`;
    await prisma.users.create({
      data: {
        username: `g${Date.now().toString().slice(-8)}`,
        email,
        password: null,
        googleId: `sub-${email}`,
        role: 'user',
      },
    });

    await request(app.getHttpServer()).post('/auth/password/forgot').send({ email }).expect(200);

    expect(sentMail).toHaveLength(1);
    expect(sentMail[0].body).toContain('Google');
    // No token to leak, because there is no password to reset.
    expect(sentMail[0].body).not.toContain('token=');
  });
});
