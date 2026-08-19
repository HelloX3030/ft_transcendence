import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import TestAgent from 'supertest/lib/agent';
import { createTestApp } from './utils/create-test-app.utils';
import { checkCookies } from './utils';
import { RegisterDto } from 'src/auth/dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { apiResponse, LoginResponse } from '@cinemates/shared';
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
    // Teardown, not an assertion: disabling now needs a code, and spending one
    // here would move totpLastCounter forward for every test that follows. The
    // delete endpoint has its own cases below.
    await resetTotp(userId);
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

  // Each delete case gets its own account: only one code per time step can be
  // spent, and window: 1 means a code more than one step ahead is not accepted
  // either, so a shared account would run out of usable codes without sleeping.
  it('refuses to disable TOTP with no code at all', async () => {
    const { agent, id } = await freshTotpUser('totp-del-nobody');

    await agent.delete('/users/mfa/totp').expect(400);

    const user = await prisma.users.findUnique({ where: { id } });
    expect(user?.totpActive).toBe(true);
    expect(user?.totpSecret).not.toBeNull();
  });

  it('refuses to disable TOTP with a wrong code', async () => {
    const { agent, id } = await freshTotpUser('totp-del-wrong');

    await agent.delete('/users/mfa/totp').send({ otp: '000000' }).expect(400);

    const user = await prisma.users.findUnique({ where: { id } });
    expect(user?.totpActive).toBe(true);
    expect(user?.totpSecret).not.toBeNull();
  });

  // The one that catches a non-atomic implementation: the code is verified and
  // burned in a single statement, so one already spent on a login is dead.
  it('refuses a code that was just spent logging in', async () => {
    const { agent, id, secret, credentials: dto } = await freshTotpUser('totp-del-replay');

    const loginAgent = request.agent(app.getHttpServer());
    const otp = nextWindowOtp(secret);
    await loginAgent
      .post('/auth/mfa/verify')
      .send({ mfaToken: await startMfaLogin(loginAgent, dto), otp })
      .expect(200);

    await agent.delete('/users/mfa/totp').send({ otp }).expect(400);

    const user = await prisma.users.findUnique({ where: { id } });
    expect(user?.totpActive).toBe(true);
  });

  it('disables TOTP with a fresh valid code, and login stops asking for one', async () => {
    const { agent, id, secret, credentials: dto } = await freshTotpUser('totp-del-ok');

    const response = await agent
      .delete('/users/mfa/totp')
      .send({ otp: nextWindowOtp(secret) })
      .expect(200);

    const body = response.body as apiResponse<null>;
    expect(body.success).toBe(true);
    expect(body.message).toBe('TOTP deleted.');

    const user = await prisma.users.findUnique({ where: { id } });
    expect(user?.totpSecret).toBeNull();
    expect(user?.totpActive).toBe(false);

    const login = await request
      .agent(app.getHttpServer())
      .post('/auth/login')
      .send({ email: dto.email, password: dto.password })
      .expect(200);

    expect((login.body as apiResponse<LoginResponse>).data).toMatchObject({
      mfaRequired: false,
    });
  });

  // An abandoned enrolment has nothing to protect and no scanned QR to read a
  // code from, and createTOTP refuses to replace an existing secret — so this
  // has to stay clearable or the account is stuck with no way to enrol.
  it('clears a never-activated setup without a code', async () => {
    const dto = buildRegisterDto('totp-del-pending');
    const agent = await registerUser(app, dto);
    const id = await getCurrentUserId(agent);

    await agent.post('/users/mfa/totp/setup').expect(201);
    expect((await prisma.users.findUnique({ where: { id } }))?.totpSecret).not.toBeNull();

    await agent.delete('/users/mfa/totp').expect(200);

    const user = await prisma.users.findUnique({ where: { id } });
    expect(user?.totpSecret).toBeNull();
    expect(user?.totpActive).toBe(false);
  });

  /** A brand-new account with TOTP already enrolled and active. */
  async function freshTotpUser(prefix: string) {
    const dto = buildRegisterDto(prefix);
    const agent = await registerUser(app, dto);
    const id = await getCurrentUserId(agent);
    const secret = await enableTotpFor(agent, id);

    return { agent, id, secret, credentials: dto };
  }

  /** Direct write on purpose: teardown must not spend a TOTP counter. */
  async function resetTotp(id: number) {
    await prisma.users.update({
      where: { id },
      data: { totpSecret: null, totpActive: false, totpLastCounter: null },
    });
  }

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
  };
}
