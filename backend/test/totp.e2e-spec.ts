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
import { decrypt, getMfaKey } from 'src/utils';

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

    const otp = await generateOtpFromStoredSecret(user!.totpSecret!);

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
      mfaTyp: 'totp',
    });
  });

  it('logs in successfully with valid TOTP code', async () => {
    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    const otp = await generateOtpFromStoredSecret(user!.totpSecret!);

    const loginAgent = request.agent(app.getHttpServer());

    const response = await loginAgent
      .post('/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password,
        otp,
      })
      .expect(200);

    const body = response.body as apiResponse<LoginResponse>;

    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      mfaRequired: false,
      mfaTyp: 'none',
    });

    checkCookies(response);
  });

  it('rejects invalid TOTP during login', async () => {
    const loginAgent = request.agent(app.getHttpServer());

    const response = await loginAgent
      .post('/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password,
        otp: '123456',
      })
      .expect(403);

    const body = response.body as { message: string };

    expect(body.message).toBe('Invalid TOTP');
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

  async function enableTotp() {
    await userAgent.post('/users/mfa/totp/setup').expect(201);

    const user = await prisma.users.findUnique({
      where: {
        id: userId,
      },
    });

    const otp = await generateOtpFromStoredSecret(user!.totpSecret!);

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

  async function generateOtpFromStoredSecret(secret: string) {
    const key = getMfaKey();
    const [ivHex, encryptedSecret] = secret.split(':');

    let iv = Buffer.from(ivHex, 'hex');

    secret = decrypt(encryptedSecret, key, iv);

    let totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });
    return totp.generate();
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
