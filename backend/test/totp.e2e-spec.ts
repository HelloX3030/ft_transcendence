import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import TestAgent from 'supertest/lib/agent';
import { createTestApp } from './utils/create-test-app.utils';
import { checkCookies } from './utils';
import { RegisterDto } from 'src/auth/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { apiResponse, LoginResponse } from '@trailertinder/shared';
import * as OTPAuth from 'otpauth';
import { decryptSecret } from 'src/utils/crypto.utils';

const TOTP_PERIOD_MS = 30_000;

describe('TOTP MFA (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAgent: TestAgent;
  let credentials: RegisterDto;
  let userId: number;

  beforeAll(async () => {
    app = await createTestApp();

    prisma = app.get(PrismaService);

    credentials = buildRegisterDto('totp-user');

    userAgent = await registerUser(app, credentials);

    userId = await getCurrentUserId(userAgent);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('creates a TOTP setup and returns a QR code', async () => {
    const response = await userAgent.post('/users/mfa/totp/setup').expect(201);

    const body = response.body as apiResponse<string>;

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data).toContain('<svg');

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    expect(user?.totpSecret).not.toBeNull();
    expect(user?.totpActive).toBe(false);
  });

  it('activates TOTP with a valid OTP code', async () => {
    await userAgent.post('/users/mfa/totp/setup').expect(201);

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    expect(user?.totpSecret).not.toBeNull();

    const otp = generateOtpFromStoredSecret(user!.totpSecret!);

    const response = await userAgent
      .post('/users/mfa/totp/activate')
      .send({
        otp,
      })
      .expect(201);

    const body = response.body as apiResponse<null>;

    expect(body.success).toBe(true);
    expect(body.message).toBe('TOTP verified and activated successfully.');

    const updatedUser = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    expect(updatedUser?.totpActive).toBe(true);
    await userAgent.delete('/users/mfa/totp').expect(200);
  });

  it('requires TOTP during login when TOTP is active', async () => {
    await enableTotp();

    const loginAgent = request.agent(app.getHttpServer());

    const response = await loginAgent
      .post('/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password,
      })
      .expect(200);

    const body = response.body as apiResponse<LoginResponse>;

    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      mfaRequired: true,
      mfaType: 'totp',
    });
    // The challenge token replaces re-sending the password on the second step.
    expect(typeof body.data?.mfaToken).toBe('string');
  });

  it('logs in successfully by exchanging the challenge token for a session', async () => {
    const loginAgent = request.agent(app.getHttpServer());
    const mfaToken = await startMfaLogin(loginAgent);

    const user = await prisma.users.findUnique({ where: { id: userId } });
    const otp = nextWindowOtp(user!.totpSecret!);

    const response = await loginAgent.post('/auth/mfa/verify').send({ mfaToken, otp }).expect(200);

    const body = response.body as apiResponse<LoginResponse>;

    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      mfaRequired: false,
      mfaType: 'none',
    });

    checkCookies(response);
  });

  it('never accepts an otp on the password step', async () => {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    const otp = generateOtpFromStoredSecret(user!.totpSecret!);

    const response = await request
      .agent(app.getHttpServer())
      .post('/auth/login')
      .send({ email: credentials.email, password: credentials.password, otp })
      .expect(400);

    // forbidNonWhitelisted: a one-shot login carrying the code is no longer a
    // thing the API offers, rather than being quietly ignored.
    expect((response.body as { statusCode: number }).statusCode).toBe(400);
  });

  it('rejects an invalid TOTP against a valid challenge token', async () => {
    const loginAgent = request.agent(app.getHttpServer());
    const mfaToken = await startMfaLogin(loginAgent);

    const response = await loginAgent
      .post('/auth/mfa/verify')
      .send({ mfaToken, otp: '123456' })
      .expect(403);

    expect((response.body as { message: string }).message).toBe('Invalid TOTP');
  });

  it('rejects a forged challenge token', async () => {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    const otp = generateOtpFromStoredSecret(user!.totpSecret!);

    const response = await request
      .agent(app.getHttpServer())
      .post('/auth/mfa/verify')
      .send({ mfaToken: 'not.a.token', otp })
      .expect(403);

    // Same message as a wrong code, so this cannot be used to tell a valid
    // challenge token from an invalid one.
    expect((response.body as { message: string }).message).toBe('Invalid TOTP');
  });

  // Needs an untouched account: only one code per time step can ever be spent,
  // and the tests above have already spent this window's on the shared user.
  it('refuses to spend the same code twice', async () => {
    const other = buildRegisterDto('totp-replay');
    const otherAgent = await registerUser(app, other);
    const otherId = await getCurrentUserId(otherAgent);
    const secret = await enableTotpFor(otherAgent, otherId);

    const otp = nextWindowOtp(secret);

    const first = request.agent(app.getHttpServer());
    await first
      .post('/auth/mfa/verify')
      .send({ mfaToken: await startMfaLogin(first, other), otp })
      .expect(200);

    const second = request.agent(app.getHttpServer());
    await second
      .post('/auth/mfa/verify')
      .send({ mfaToken: await startMfaLogin(second, other), otp })
      .expect(403);
  });

  it('deletes TOTP successfully', async () => {
    const response = await userAgent.delete('/users/mfa/totp').expect(200);

    const body = response.body as apiResponse<null>;

    expect(body.success).toBe(true);
    expect(body.message).toBe('TOTP deleted.');

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    expect(user?.totpSecret).toBeNull();
    expect(user?.totpActive).toBe(false);
  });

  /** Runs the password step and returns the challenge token it hands back. */
  async function startMfaLogin(
    agent: ReturnType<typeof request.agent>,
    as: RegisterDto = credentials,
  ): Promise<string> {
    const response = await agent
      .post('/auth/login')
      .send({ email: as.email, password: as.password })
      .expect(200);

    const body = response.body as apiResponse<LoginResponse>;
    return body.data!.mfaToken!;
  }

  /** Turns TOTP on for an arbitrary account and hands back its stored secret. */
  async function enableTotpFor(agent: TestAgent, id: number): Promise<string> {
    await agent.post('/users/mfa/totp/setup').expect(201);

    const user = await prisma.users.findUnique({ where: { id } });
    await agent
      .post('/users/mfa/totp/activate')
      .send({ otp: generateOtpFromStoredSecret(user!.totpSecret!) })
      .expect(201);

    return user!.totpSecret!;
  }

  async function enableTotp() {
    await userAgent.post('/users/mfa/totp/setup').expect(201);

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    const otp = generateOtpFromStoredSecret(user!.totpSecret!);

    await userAgent
      .post('/users/mfa/totp/activate')
      .send({
        otp,
      })
      .expect(201);
  }

  async function registerUser(application: INestApplication, dto: RegisterDto) {
    const agent = request.agent(application.getHttpServer());

    const response = await agent
      .post('/auth/register')
      .set('Accept', 'application/json')
      .send(dto)
      .expect('Content-Type', /json/)
      .expect(201);

    const body = response.body as { message: string };

    expect(body.message).toBe('User registered successfully');

    checkCookies(response);

    return agent;
  }

  async function getCurrentUserId(agent: TestAgent) {
    const response = await agent.get('/auth/me').expect(200);

    const body = response.body as { sub: number };

    return body.sub;
  }

  function generateOtpFromStoredSecret(secret: string, offsetMs = 0) {
    secret = decryptSecret(secret);

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });
    return totp.generate({ timestamp: Date.now() + offsetMs });
  }

  /**
   * A code from the next time step, which the ±1 skew window still accepts.
   *
   * Activation spends the current step's counter, and a spent counter is never
   * accepted again, so a login test generating a code the ordinary way inside
   * the same 30 seconds would be refused as a replay. Reaching one step forward
   * keeps these tests instant instead of sleeping out the window.
   */
  function nextWindowOtp(secret: string) {
    return generateOtpFromStoredSecret(secret, TOTP_PERIOD_MS);
  }
});

function buildRegisterDto(prefix: string): RegisterDto {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  return {
    username: `${prefix}-${token}`.slice(0, 32),
    email: `${prefix}-${token}@example.com`,
    password: 'Test123!',
    language: 'en',
  };
}
