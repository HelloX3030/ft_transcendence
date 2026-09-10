import { MetricsService } from 'src/metrics/metrics.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { RedisService } from 'src/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleProfile, JwtRefreshPayload } from 'src/types';
import { verifyTOTP } from 'src/utils/otp.utils';
import {
  AuthService,
  generateUsernameStem,
  GoogleAuthException,
  hashResetToken,
} from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { DAY_MS } from 'src/retention.config';

jest.mock('argon2');
const mockArgon2 = jest.mocked(argon2);

jest.mock('src/utils/otp.utils');
const mockVerifyTOTP = jest.mocked(verifyTOTP);

const mockPayload: JwtRefreshPayload = {
  sub: 1,
  sessionId: 10,
  session: 'session-key',
};

const mockSession = {
  id: 10,
  userId: 1,
  sessionHash: 'hashed-session-key',
  previousHash: null,
  rotatedAt: null,
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  expiresAt: new Date(Date.now() + 1000),
  createdAt: new Date(),
};

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  password: 'hashed-password',
};

// PrismaService inherits a large generated client; only type the slice this service uses.
const mockPrisma = {
  users: {
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  sessions: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  password_resets: {
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

// The client handed to an interactive $transaction callback. Separate from
// mockPrisma so a test can assert a write happened *inside* the transaction
// rather than merely on the service's own client.
const mockTx = {
  users: { update: jest.fn() },
  password_resets: { update: jest.fn() },
  sessions: { deleteMany: jest.fn() },
};

const mockMail = {
  send: jest.fn(),
  sendInBackground: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockJwt = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
} satisfies Partial<jest.Mocked<JwtService>>;

// Returns the spies alongside the response so assertions never reference
// `res.cookie` as an unbound method. `req.secure` is what decides the Secure
// flag, so it has to be part of the fake response the way Express provides it.
function mockResponse(secure = false): {
  res: ExpressResponse;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
} {
  const cookie = jest.fn();
  const clearCookie = jest.fn();
  const redirect = jest.fn();
  return {
    res: { cookie, clearCookie, redirect, req: { secure } } as unknown as ExpressResponse,
    cookie,
    clearCookie,
    redirect,
  };
}

function mockRequest(cookies: Record<string, string> = {}, query: Record<string, string> = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
    cookies,
    query,
  } as unknown as ExpressRequest;
}

function prismaError(code: string, target?: string[]): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', {
    code,
    clientVersion: '5.0.0',
    meta: target ? { target } : undefined,
  });
}

const registerDto: RegisterDto = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'pw-plaintext',
};

const loginDto: LoginDto = { email: 'test@example.com', password: 'pw-plaintext' };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: MailService, useValue: mockMail },
        { provide: RedisService, useValue: mockRedis },
        MetricsService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    Object.values(mockTx).forEach((model) => Object.values(model).forEach((fn) => fn.mockReset()));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    beforeEach(() => {
      mockArgon2.hash.mockResolvedValue('hashed-password');
      mockJwt.signAsync.mockResolvedValue('signed-token');
      mockPrisma.sessions.create.mockResolvedValue(mockSession);
    });

    it('creates the user, issues tokens and sets both cookies', async () => {
      mockPrisma.users.create.mockResolvedValue(mockUser);
      const { res, cookie } = mockResponse();

      const result = await service.register(mockRequest(), registerDto, res);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User registered successfully');
      // Reported so the client can renew before the cookie lapses rather than
      // after a 401 the browser prints to the console.
      expect(result.data?.accessExpiresAt).toBeGreaterThan(Date.now());
      expect(cookie).toHaveBeenCalledWith('access_token', 'signed-token', expect.any(Object));
      expect(cookie).toHaveBeenCalledWith('refresh_token', 'signed-token', expect.any(Object));
    });

    it('marks both cookies Secure and HttpOnly when the request came over HTTPS', async () => {
      mockPrisma.users.create.mockResolvedValue(mockUser);
      const { res, cookie } = mockResponse(true);

      await service.register(mockRequest(), registerDto, res);

      for (const name of ['access_token', 'refresh_token']) {
        expect(cookie).toHaveBeenCalledWith(
          name,
          'signed-token',
          expect.objectContaining({ secure: true, httpOnly: true, sameSite: 'strict' }) as object,
        );
      }
    });

    it('stores the argon2 hash and never the plaintext password', async () => {
      mockPrisma.users.create.mockResolvedValue(mockUser);

      await service.register(mockRequest(), registerDto, mockResponse().res);

      expect(mockArgon2.hash).toHaveBeenCalledWith(registerDto.password);

      const created = (mockPrisma.users.create.mock.calls as unknown[][])[0][0] as {
        data: { password: string; email: string };
      };
      expect(created.data.password).toBe('hashed-password');
      expect(created.data.password).not.toBe(registerDto.password);
    });

    // A duplicate email/username is a state conflict (409), not a permissions
    // failure (403).
    it('throws ConflictException on a unique-constraint violation', async () => {
      mockPrisma.users.create.mockRejectedValue(prismaError('P2002'));
      const { res, cookie } = mockResponse();

      await expect(service.register(mockRequest(), registerDto, res)).rejects.toThrow(
        ConflictException,
      );
      expect(cookie).not.toHaveBeenCalled();
    });

    it('does not disclose which field collided', async () => {
      mockPrisma.users.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.register(mockRequest(), registerDto, mockResponse().res),
      ).rejects.toThrow('Credentials taken');
    });

    it('rethrows Prisma errors that are not unique-constraint violations', async () => {
      mockPrisma.users.create.mockRejectedValue(prismaError('P2003'));

      await expect(
        service.register(mockRequest(), registerDto, mockResponse().res),
      ).rejects.not.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const totpUser = { ...mockUser, totpActive: true, totpSecret: 'iv:cipher' };
    const plainUser = { ...mockUser, totpActive: false, totpSecret: null };

    beforeEach(() => {
      mockArgon2.verify.mockResolvedValue(true);
      mockJwt.signAsync.mockResolvedValue('signed-token');
      mockPrisma.sessions.create.mockResolvedValue(mockSession);
    });

    it('issues tokens and sets cookies for a user without MFA', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(plainUser);
      const { res, cookie } = mockResponse();

      const result = await service.login(mockRequest(), loginDto, res);

      const { accessExpiresAt, ...answer } = result.data!;
      expect(answer).toEqual({ mfaRequired: false, mfaType: 'none' });
      expect(accessExpiresAt).toBeGreaterThan(Date.now());
      expect(cookie).toHaveBeenCalledTimes(2);
    });

    it('rejects an unknown email', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const { res, cookie } = mockResponse();

      await expect(service.login(mockRequest(), loginDto, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    // A Google-only account has no local password. argon2.verify on a null hash
    // throws a raw error the global filter turns into a 500, so this has to be
    // caught before the call, a clean 403, not a stack trace.
    it('rejects a password login against a password-less account without calling argon2', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ ...plainUser, password: null });
      const { res, cookie } = mockResponse();

      await expect(service.login(mockRequest(), loginDto, res)).rejects.toThrow(ForbiddenException);
      expect(mockArgon2.verify).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    // Same message as a wrong password: whether an account is Google-only is not
    // something an unauthenticated caller should be able to probe for.
    it('does not disclose that the account is Google-only', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ ...plainUser, password: null });

      await expect(service.login(mockRequest(), loginDto, mockResponse().res)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('rejects a wrong password', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(plainUser);
      mockArgon2.verify.mockResolvedValue(false);
      const { res, cookie } = mockResponse();

      await expect(service.login(mockRequest(), loginDto, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('gives the same message for an unknown email and a wrong password', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const unknown = await service
        .login(mockRequest(), loginDto, mockResponse().res)
        .catch((e: Error) => e.message);

      mockPrisma.users.findUnique.mockResolvedValue(plainUser);
      mockArgon2.verify.mockResolvedValue(false);
      const wrongPw = await service
        .login(mockRequest(), loginDto, mockResponse().res)
        .catch((e: Error) => e.message);

      expect(unknown).toBe(wrongPw);
    });

    it('hands back a challenge token instead of logging in when MFA is active', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      const { res, cookie } = mockResponse();

      const result = await service.login(mockRequest(), loginDto, res);

      expect(result.data).toEqual({
        mfaRequired: true,
        mfaType: 'totp',
        mfaToken: 'signed-token',
      });
      // No session may be established until the second factor is supplied.
      expect(cookie).not.toHaveBeenCalled();
      expect(mockPrisma.sessions.create).not.toHaveBeenCalled();
    });

    it('signs the challenge token with a key the access secret cannot produce', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);

      await service.login(mockRequest(), loginDto, mockResponse().res);

      const [, options] = mockJwt.signAsync.mock.calls.at(-1) as [unknown, { secret: string }];
      // Derived, so a challenge token can never validate as an access token:
      // it is issued before the second factor and carries no authority.
      expect(options.secret).not.toBe(process.env.JWT_ACCESS_SECRET);
      expect(options.secret).toEqual(expect.any(String));
    });

    it('fails closed when MFA is active but no secret is stored', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ ...totpUser, totpSecret: null });
      const { res, cookie } = mockResponse();

      await expect(service.login(mockRequest(), loginDto, res)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(cookie).not.toHaveBeenCalled();
    });
  });

  describe('verifyMfa', () => {
    const totpUser = { ...mockUser, totpActive: true, totpSecret: 'iv:tag:cipher' };
    const dto = { mfaToken: 'challenge-token', otp: '213846' };

    beforeEach(() => {
      mockJwt.signAsync.mockResolvedValue('signed-token');
      mockJwt.verifyAsync.mockResolvedValue({ sub: totpUser.id, purpose: 'mfa' });
      mockPrisma.sessions.create.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(58_000_000);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
    });

    it('issues a session for a valid challenge token and code', async () => {
      const { res, cookie } = mockResponse();

      const result = await service.verifyMfa(mockRequest(), dto, res);

      const { accessExpiresAt, ...answer } = result.data!;
      expect(answer).toEqual({ mfaRequired: false, mfaType: 'none' });
      expect(accessExpiresAt).toBeGreaterThan(Date.now());
      expect(cookie).toHaveBeenCalledTimes(2);
    });

    it('never asks for the password again', async () => {
      await service.verifyMfa(mockRequest(), dto, mockResponse().res);

      expect(mockArgon2.verify).not.toHaveBeenCalled();
    });

    // The Google flow ends in a redirect, so the client never sees a body to
    // hold the challenge token in, so the backend leaves it in a cookie.
    it('falls back to the mfa_token cookie when the body omits it', async () => {
      const { res, cookie } = mockResponse();

      const result = await service.verifyMfa(
        mockRequest({ mfa_token: 'cookie-token' }),
        { otp: dto.otp },
        res,
      );

      expect(mockJwt.verifyAsync).toHaveBeenCalledWith('cookie-token', expect.any(Object));
      const { accessExpiresAt, ...answer } = result.data!;
      expect(answer).toEqual({ mfaRequired: false, mfaType: 'none' });
      expect(accessExpiresAt).toBeGreaterThan(Date.now());
      expect(cookie).toHaveBeenCalledTimes(2);
    });

    it('prefers the body token over the cookie when both are present', async () => {
      await service.verifyMfa(mockRequest({ mfa_token: 'cookie-token' }), dto, mockResponse().res);

      expect(mockJwt.verifyAsync).toHaveBeenCalledWith('challenge-token', expect.any(Object));
    });

    it('rejects when neither the body nor a cookie carries a token', async () => {
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), { otp: dto.otp }, res)).rejects.toThrow(
        ForbiddenException,
      );
      expect(cookie).not.toHaveBeenCalled();
    });

    it('clears the challenge cookie once it has been spent', async () => {
      const { res, clearCookie } = mockResponse();

      await service.verifyMfa(mockRequest({ mfa_token: 'cookie-token' }), { otp: dto.otp }, res);

      expect(clearCookie).toHaveBeenCalledWith('mfa_token');
    });

    it('burns the counter of a used code so it cannot be replayed', async () => {
      await service.verifyMfa(mockRequest(), dto, mockResponse().res);

      // The counter is both filter and payload, so the check and the write are
      // a single statement and two racing logins cannot both spend it.
      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: {
          id: totpUser.id,
          OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: 58_000_000 } }],
        },
        data: { totpLastCounter: 58_000_000 },
      });
    });

    it('rejects a code whose counter was already spent', async () => {
      mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), dto, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects an invalid code without touching the row', async () => {
      mockVerifyTOTP.mockReturnValue(null);
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), dto, res)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects a challenge token that does not verify', async () => {
      mockJwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), dto, res)).rejects.toThrow(ForbiddenException);
      expect(mockVerifyTOTP).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects a token signed for some other purpose', async () => {
      mockJwt.verifyAsync.mockResolvedValue({ sub: totpUser.id, email: 'a@b.c' });
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), dto, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects a challenge for a user who has since disabled TOTP', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ ...totpUser, totpActive: false });
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), dto, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('rejects a challenge for a user who has since been deleted', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const { res, cookie } = mockResponse();

      await expect(service.verifyMfa(mockRequest(), dto, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('answers a bad token and a bad code identically', async () => {
      mockJwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      const badToken = await service
        .verifyMfa(mockRequest(), dto, mockResponse().res)
        .catch((e: Error) => e.message);

      mockJwt.verifyAsync.mockResolvedValue({ sub: totpUser.id, purpose: 'mfa' });
      mockVerifyTOTP.mockReturnValue(null);
      const badCode = await service
        .verifyMfa(mockRequest(), dto, mockResponse().res)
        .catch((e: Error) => e.message);

      expect(badToken).toBe(badCode);
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      mockArgon2.verify.mockResolvedValue(true);
      mockJwt.signAsync.mockResolvedValue('signed-token');
      mockPrisma.sessions.update.mockResolvedValue(mockSession);
      mockPrisma.sessions.updateMany.mockResolvedValue({ count: 1 });
    });

    it('issues new tokens and sets both cookies on a valid session', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      const { res, cookie } = mockResponse();

      const result = await service.refresh(mockPayload, res);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token refreshed');
      expect(result.data?.accessExpiresAt).toBeGreaterThan(Date.now());
      expect(cookie).toHaveBeenCalledWith('access_token', 'signed-token', expect.any(Object));
      expect(cookie).toHaveBeenCalledWith('refresh_token', 'signed-token', expect.any(Object));
    });

    it('throws when the session id is not in the database', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(null);
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('throws when the session key does not match the stored hash', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockArgon2.verify.mockResolvedValue(false);
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('throws when the session belongs to a different user than the token subject', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue({ ...mockSession, userId: 2 });
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.users.findUnique).not.toHaveBeenCalled();
      expect(mockJwt.signAsync).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('looks the user up by the session owner rather than the token subject', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);

      await service.refresh(mockPayload, mockResponse().res);

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: mockSession.userId },
      });
      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockSession.userId }),
        expect.any(Object),
      );
    });

    it('throws when the session owner no longer exists', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(InternalServerErrorException);
      expect(cookie).not.toHaveBeenCalled();
    });

    // Without rotation a captured refresh token stays valid for its whole
    // lifetime however often the real user refreshes: using it never spends it.
    it('writes a session hash different from the one it read', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      mockArgon2.hash.mockResolvedValue('rotated-hash');

      await service.refresh(mockPayload, mockResponse().res);

      const update = (mockPrisma.sessions.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { sessionHash: string; previousHash: string; rotatedAt: Date };
      };
      expect(update.data.sessionHash).toBe('rotated-hash');
      expect(update.data.sessionHash).not.toBe(mockSession.sessionHash);
    });

    it('keeps the superseded hash and the rotation time for the grace window', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);

      await service.refresh(mockPayload, mockResponse().res);

      const update = (mockPrisma.sessions.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { previousHash: string; rotatedAt: Date };
      };
      expect(update.data.previousHash).toBe(mockSession.sessionHash);
      expect(update.data.rotatedAt).toBeInstanceOf(Date);
    });

    // The multi-tab race: both tabs read the same cookie and both refresh. The
    // loser must not be logged out while holding a freshly rotated cookie.
    it('accepts the superseded key inside the grace window without rotating again', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue({
        ...mockSession,
        previousHash: 'superseded-hash',
        rotatedAt: new Date(Date.now() - 1000),
      });
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      // Current hash fails, previous hash matches.
      mockArgon2.verify.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const { res, cookie } = mockResponse();

      const result = await service.refresh(mockPayload, res);

      expect(result.success).toBe(true);
      expect(cookie).toHaveBeenCalledWith('refresh_token', 'signed-token', expect.any(Object));
      // Neither a second rotation nor a second extension of expiresAt: two tabs
      // could otherwise ping-pong rotations indefinitely.
      expect(mockPrisma.sessions.updateMany).not.toHaveBeenCalled();
    });

    it('rejects the superseded key once the grace window has passed', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue({
        ...mockSession,
        previousHash: 'superseded-hash',
        rotatedAt: new Date(Date.now() - 60_000),
      });
      mockArgon2.verify.mockResolvedValue(false);
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    // Reuse detection is deliberately not wired up: a false positive would log a
    // legitimate user out of every device.
    it('does not delete the session when a stale key is presented', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockArgon2.verify.mockResolvedValue(false);

      await expect(service.refresh(mockPayload, mockResponse().res)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.sessions.deleteMany).not.toHaveBeenCalled();
    });

    // The 5-minute sweep is garbage collection, not the enforcement mechanism.
    it('rejects a session past its expiry even though the row still exists', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
      expect(mockPrisma.sessions.updateMany).not.toHaveBeenCalled();
    });

    it('slides the expiry by the refresh lifetime on an ordinary refresh', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);

      await service.refresh(mockPayload, mockResponse().res);

      const update = (mockPrisma.sessions.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { expiresAt: Date };
      };
      const slid = update.data.expiresAt.getTime() - Date.now();
      expect(slid).toBeGreaterThan(14.9 * DAY_MS);
      expect(slid).toBeLessThanOrEqual(15 * DAY_MS);
    });

    // Sliding alone means an actively used session never ends.
    it('clamps the expiry to the absolute lifetime measured from createdAt', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue({
        ...mockSession,
        createdAt: new Date(Date.now() - 20 * DAY_MS),
      });
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);

      await service.refresh(mockPayload, mockResponse().res);

      const update = (mockPrisma.sessions.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { expiresAt: Date };
      };
      // 30-day cap, 20 days in: 10 days left, not another 15.
      const remaining = update.data.expiresAt.getTime() - Date.now();
      expect(remaining).toBeLessThanOrEqual(10 * DAY_MS);
      expect(remaining).toBeGreaterThan(9.9 * DAY_MS);
    });

    it('refuses a session older than the absolute lifetime', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue({
        ...mockSession,
        createdAt: new Date(Date.now() - 31 * DAY_MS),
      });
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      const { res, cookie } = mockResponse();

      await expect(service.refresh(mockPayload, res)).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    // The cookie, the JWT and the row all derive from one number, so they cannot
    // drift apart the way four separate "15 day" literals could.
    it('derives the refresh cookie maxAge and the JWT expiry from the row', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      const { res, cookie } = mockResponse();

      await service.refresh(mockPayload, res);

      const update = (mockPrisma.sessions.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { expiresAt: Date };
      };
      const rowTtlSeconds = Math.floor((update.data.expiresAt.getTime() - Date.now()) / 1000);

      const refreshSign = (mockJwt.signAsync.mock.calls as unknown[][]).find(
        (call) => typeof call[0] === 'object' && call[0] !== null && 'session' in call[0],
      ) as [unknown, { expiresIn: number }];
      expect(refreshSign[1].expiresIn).toBeCloseTo(rowTtlSeconds, -1);

      const refreshCookie = cookie.mock.calls.find(
        (call: unknown[]) => call[0] === 'refresh_token',
      ) as [string, string, { maxAge: number }];
      expect(refreshCookie[2].maxAge / 1000).toBeCloseTo(rowTtlSeconds, -1);
    });
  });

  describe('logout', () => {
    // `delete` throws P2025 on a missing row, which the Prisma filter turns into
    // a 404. A second logout is entirely normal: the session may have been
    // swept, or another tab may have logged out already.
    it('is idempotent when the session row is already gone', async () => {
      mockPrisma.sessions.deleteMany.mockResolvedValue({ count: 0 });
      const { res } = mockResponse();

      const result = await service.logout(mockPayload, res);

      expect(result).toEqual({ success: true, message: 'Logged out', data: null });
      expect(mockPrisma.sessions.deleteMany).toHaveBeenCalledWith({
        where: { id: mockPayload.sessionId },
      });
    });

    // Express only clears a cookie when the options match those it was set with.
    it('clears both cookies with the options they were set with', async () => {
      mockPrisma.sessions.deleteMany.mockResolvedValue({ count: 1 });
      const { res, cookie, clearCookie } = mockResponse();

      service.setCookies({ access_token: 'a', refresh_token: 'r' }, res);
      await service.logout(mockPayload, res);

      const setOptions = (cookie.mock.calls[0] as [string, string, Record<string, unknown>])[2];
      for (const name of ['access_token', 'refresh_token']) {
        expect(clearCookie).toHaveBeenCalledWith(name, {
          httpOnly: setOptions.httpOnly,
          secure: setOptions.secure,
          sameSite: setOptions.sameSite,
        });
      }
    });
  });

  describe('forgotPassword', () => {
    const withPassword = { ...mockUser, password: 'hashed-password' };

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([]);
    });

    // A different response for a known and an unknown address turns this into
    // an account-existence oracle, which is the position `register` already
    // takes with its deliberately vague "Credentials taken".
    it('answers identically for a known and an unknown address', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      const unknown = await service.forgotPassword({ email: 'nobody@example.com' });

      mockPrisma.users.findUnique.mockResolvedValue(withPassword);
      const known = await service.forgotPassword({ email: withPassword.email });

      expect(unknown).toEqual(known);
    });

    it('creates no row and sends no mail for an unknown address', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await service.forgotPassword({ email: 'nobody@example.com' });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockMail.sendInBackground).not.toHaveBeenCalled();
    });

    it('creates exactly one row and sends one mail for a known address', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(withPassword);

      await service.forgotPassword({ email: withPassword.email });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockMail.sendInBackground).toHaveBeenCalledTimes(1);
    });

    it('invalidates earlier outstanding tokens before issuing a new one', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(withPassword);

      await service.forgotPassword({ email: withPassword.email });

      // Otherwise three "it didn't arrive" clicks leave three live links.
      expect(mockPrisma.password_resets.updateMany).toHaveBeenCalledWith({
        where: { userId: withPassword.id, usedAt: null },
        data: { usedAt: expect.any(Date) as Date },
      });
    });

    it('stores only the hash, and mails a token that is not in the database', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(withPassword);

      await service.forgotPassword({ email: withPassword.email });

      const created = (mockPrisma.password_resets.create.mock.calls as unknown[][])[0][0] as {
        data: { tokenHash: string };
      };
      const body = (mockMail.sendInBackground.mock.calls as unknown[][])[0][2] as string;
      const token = /token=([^\s]+)/.exec(body)?.[1];

      expect(token).toBeDefined();
      expect(created.data.tokenHash).toBe(hashResetToken(token as string));
      // A database dump must not be enough to reset anyone's password.
      expect(body).not.toContain(created.data.tokenHash);
    });

    it('tells a Google-only account it has no password, and issues no token', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ ...withPassword, password: null });

      await service.forgotPassword({ email: withPassword.email });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockMail.sendInBackground).toHaveBeenCalledTimes(1);
      expect((mockMail.sendInBackground.mock.calls as unknown[][])[0][2]).toContain('Google');
    });

    // The IP throttle does not stop someone flooding one inbox from rotating
    // addresses, so the cooldown is keyed on the account.
    it('skips the send while the per-email cooldown is live', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(withPassword);
      mockRedis.get.mockResolvedValue('1');

      const result = await service.forgotPassword({ email: withPassword.email });

      expect(mockMail.sendInBackground).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // Still the same answer: the cooldown must not become an oracle either.
      expect(result.message).toContain('If an account exists');
    });

    // Blocking password resets because a cache is down is worse than the flood
    // the cooldown prevents; RedisService already reports failures as a miss.
    it('sends anyway when Redis is unavailable', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(withPassword);
      mockRedis.get.mockResolvedValue(null);

      await service.forgotPassword({ email: withPassword.email });

      expect(mockMail.sendInBackground).toHaveBeenCalledTimes(1);
    });

    // Awaiting SMTP would leak through the response latency what the body
    // refuses to say.
    it('does not await the send', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(withPassword);

      await service.forgotPassword({ email: withPassword.email });

      expect(mockMail.send).not.toHaveBeenCalled();
      expect(mockMail.sendInBackground).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const validRecord = {
      id: 7,
      userId: mockUser.id,
      tokenHash: hashResetToken('plain-token'),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: { ...mockUser, totpActive: false, totpSecret: null },
    };
    const dto = { token: 'plain-token', password: 'N3w!Password' };

    beforeEach(() => {
      mockArgon2.hash.mockResolvedValue('new-hash');
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) =>
        typeof fn === 'function' ? await (fn as (tx: unknown) => Promise<void>)(mockTx) : undefined,
      );
    });

    it('writes the new hash, spends the token and drops every session at once', async () => {
      mockPrisma.password_resets.findUnique.mockResolvedValue(validRecord);

      await service.resetPassword(dto);

      expect(mockTx.users.update).toHaveBeenCalledWith({
        where: { id: validRecord.userId },
        data: { password: 'new-hash' },
      });
      expect(mockTx.password_resets.update).toHaveBeenCalledWith({
        where: { id: validRecord.id },
        data: { usedAt: expect.any(Date) as Date },
      });
      // The security payload: a reset that leaves sessions alive does not evict
      // whoever caused the reset.
      expect(mockTx.sessions.deleteMany).toHaveBeenCalledWith({
        where: { userId: validRecord.userId },
      });
    });

    it('never stores the plaintext password', async () => {
      mockPrisma.password_resets.findUnique.mockResolvedValue(validRecord);

      await service.resetPassword(dto);

      const written = (mockTx.users.update.mock.calls as unknown[][])[0][0] as {
        data: { password: string };
      };
      expect(written.data.password).toBe('new-hash');
      expect(written.data.password).not.toBe(dto.password);
    });

    it('does not log the user in', async () => {
      mockPrisma.password_resets.findUnique.mockResolvedValue(validRecord);

      // No response object is even passed: a mailbox alone must not produce a
      // session, and it would hide whether the new password actually works.
      const result = await service.resetPassword(dto);

      expect(result.message).toContain('log in');
      expect(mockPrisma.sessions.create).not.toHaveBeenCalled();
    });

    // Telling these three apart would confirm that a token was once real.
    it.each([
      ['an unknown token', null],
      ['an already-used token', { ...validRecord, usedAt: new Date() }],
      ['an expired token', { ...validRecord, expiresAt: new Date(Date.now() - 1) }],
    ])('rejects %s with the same generic message', async (_label, record) => {
      mockPrisma.password_resets.findUnique.mockResolvedValue(record);

      await expect(service.resetPassword(dto)).rejects.toThrow(
        'This reset link is invalid or has expired',
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    describe('with TOTP active', () => {
      const totpRecord = {
        ...validRecord,
        user: { ...mockUser, totpActive: true, totpSecret: 'iv:cipher' },
      };

      beforeEach(() => {
        mockPrisma.password_resets.findUnique.mockResolvedValue(totpRecord);
        mockVerifyTOTP.mockReturnValue(58_000_000);
        mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
      });

      // Otherwise a reset link turns email access into full account access, and
      // the second factor is bypassed by password recovery.
      it('refuses to reset without an OTP and says one is needed', async () => {
        await expect(service.resetPassword(dto)).rejects.toMatchObject({
          status: 403,
          response: { mfaRequired: true },
        });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('accepts a correct OTP', async () => {
        await service.resetPassword({ ...dto, otp: '213846' });

        expect(mockTx.users.update).toHaveBeenCalled();
      });

      it('rejects a wrong OTP without touching the password', async () => {
        mockVerifyTOTP.mockReturnValue(null);

        await expect(service.resetPassword({ ...dto, otp: '000000' })).rejects.toThrow(
          BadRequestException,
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('rejects an OTP that has already been spent', async () => {
        mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.resetPassword({ ...dto, otp: '213846' })).rejects.toThrow(
          BadRequestException,
        );
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      // Answering "this account has 2FA" for a token that was never valid would
      // leak account state to anyone guessing tokens.
      it('does not reveal that the account has 2FA when the token is invalid', async () => {
        mockPrisma.password_resets.findUnique.mockResolvedValue(null);

        await expect(service.resetPassword(dto)).rejects.toThrow(
          'This reset link is invalid or has expired',
        );
      });
    });
  });

  describe('generateUsernameStem', () => {
    it('lowercases and strips the local part to [a-z0-9_]', () => {
      // Separators go, the characters around them stay. Plus-addressing is not
      // unwrapped; the '+' is stripped like any other punctuation.
      expect(generateUsernameStem('Alice.Smith+tag@example.com')).toBe('alicesmithtag');
      expect(generateUsernameStem('a_b-c.d@example.com')).toBe('a_bcd0');
    });

    // The backend's own minimum is 3, but the frontend's schemas require 6. A
    // shorter name would leave a Google user on a profile form they cannot save.
    it('pads a short local part to six characters', () => {
      expect(generateUsernameStem('bo@example.com')).toHaveLength(6);
    });

    it('leaves room for a suffix inside the column width', () => {
      const stem = generateUsernameStem(`${'a'.repeat(40)}@example.com`);

      expect(stem).toHaveLength(28);
      expect(`${stem}1234`.length).toBeLessThanOrEqual(32);
    });

    it('falls back to a readable stem when nothing survives stripping', () => {
      expect(generateUsernameStem('日本語@example.com')).toBe('user00');
    });
  });

  describe('googleLogin', () => {
    const googleProfile: GoogleProfile = {
      googleId: 'google-sub-123',
      email: 'test@example.com',
      emailVerified: true,
    };
    const plainUser = { ...mockUser, totpActive: false, totpSecret: null, googleId: null };

    beforeEach(() => {
      mockJwt.signAsync.mockResolvedValue('signed-token');
      mockPrisma.sessions.create.mockResolvedValue(mockSession);
    });

    it('logs in a user already linked to this Google account', async () => {
      mockPrisma.users.findUnique.mockResolvedValueOnce({
        ...plainUser,
        googleId: googleProfile.googleId,
      });
      const { res, cookie } = mockResponse();

      const result = await service.googleLogin(mockRequest(), googleProfile, res);

      expect(result).toEqual({ mfaRequired: false });
      expect(cookie).toHaveBeenCalledTimes(2);
      // A known identity must not rewrite the account it belongs to.
      expect(mockPrisma.users.update).not.toHaveBeenCalled();
      expect(mockPrisma.users.create).not.toHaveBeenCalled();
    });

    it('links a verified email to an existing local account', async () => {
      mockPrisma.users.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce(plainUser); // by email
      mockPrisma.users.update.mockResolvedValue({
        ...plainUser,
        googleId: googleProfile.googleId,
      });

      await service.googleLogin(mockRequest(), googleProfile, mockResponse().res);

      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: plainUser.id },
        data: { googleId: googleProfile.googleId },
      });
    });

    // Unconditional linking is an account-takeover primitive: a provider that
    // lets a user claim an arbitrary unverified address would hand them someone
    // else's account here.
    it('refuses to link an unverified email, and writes nothing', async () => {
      mockPrisma.users.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(plainUser);
      const { res, cookie } = mockResponse();

      await expect(
        service.googleLogin(mockRequest(), { ...googleProfile, emailVerified: false }, res),
      ).rejects.toThrow(new GoogleAuthException('unverified_email'));

      expect(mockPrisma.users.update).not.toHaveBeenCalled();
      expect(cookie).not.toHaveBeenCalled();
    });

    it('never overwrites an existing link to a different Google account', async () => {
      mockPrisma.users.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...plainUser, googleId: 'someone-else' });

      await expect(
        service.googleLogin(mockRequest(), googleProfile, mockResponse().res),
      ).rejects.toThrow(new GoogleAuthException('email_taken'));

      expect(mockPrisma.users.update).not.toHaveBeenCalled();
    });

    it('creates a password-less, un-onboarded account when nothing matches', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.users.create.mockResolvedValue(plainUser);

      await service.googleLogin(mockRequest(), googleProfile, mockResponse().res);

      const created = (mockPrisma.users.create.mock.calls as unknown[][])[0][0] as {
        data: Record<string, unknown>;
      };
      expect(created.data.password).toBeNull();
      expect(created.data.googleId).toBe(googleProfile.googleId);
      expect(created.data.username).toBe('test00');
      // onboardingCompleted defaults to false, which is what routes the new user
      // through /onboarding exactly like a local signup.
      expect(created.data.onboardingCompleted).toBeUndefined();
    });

    it('retries a username collision with a different suffix each time', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.users.create
        .mockRejectedValueOnce(prismaError('P2002', ['username']))
        .mockRejectedValueOnce(prismaError('P2002', ['username']))
        .mockResolvedValue(plainUser);

      await service.googleLogin(mockRequest(), googleProfile, mockResponse().res);

      const names = (mockPrisma.users.create.mock.calls as unknown[][]).map(
        (call) => (call[0] as { data: { username: string } }).data.username,
      );
      expect(names).toHaveLength(3);
      expect(new Set(names).size).toBe(3);
      // The clean stem first, so most signups never see a digit at all.
      expect(names[0]).toBe('test00');
    });

    it('gives up after a bounded number of username attempts', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.users.create.mockRejectedValue(prismaError('P2002', ['username']));

      await expect(
        service.googleLogin(mockRequest(), googleProfile, mockResponse().res),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockPrisma.users.create).toHaveBeenCalledTimes(5);
    });

    // An email collision is not something a different username can resolve, so
    // retrying would just burn attempts on a guaranteed failure.
    it('does not retry a collision on a column other than username', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.users.create.mockRejectedValue(prismaError('P2002', ['email']));

      await expect(
        service.googleLogin(mockRequest(), googleProfile, mockResponse().res),
      ).rejects.toThrow(PrismaClientKnownRequestError);

      expect(mockPrisma.users.create).toHaveBeenCalledTimes(1);
    });

    // Skipping the second factor would mean a compromised Google account walks
    // straight past it, which is the whole point of having one.
    it('still demands the OTP when the target account has TOTP enabled', async () => {
      mockPrisma.users.findUnique.mockResolvedValueOnce({
        ...plainUser,
        googleId: googleProfile.googleId,
        totpActive: true,
        totpSecret: 'iv:cipher',
      });
      const { res, cookie } = mockResponse();

      const result = await service.googleLogin(mockRequest(), googleProfile, res);

      expect(result).toEqual({ mfaRequired: true });
      // The challenge cookie, and no session cookies.
      expect(cookie).toHaveBeenCalledTimes(1);
      expect(cookie).toHaveBeenCalledWith('mfa_token', 'signed-token', expect.any(Object));
    });

    it('scopes the challenge cookie to lax so it survives the redirect back', async () => {
      mockPrisma.users.findUnique.mockResolvedValueOnce({
        ...plainUser,
        googleId: googleProfile.googleId,
        totpActive: true,
        totpSecret: 'iv:cipher',
      });
      const { res, cookie } = mockResponse(true);

      await service.googleLogin(mockRequest(), googleProfile, res);

      expect(cookie).toHaveBeenCalledWith(
        'mfa_token',
        'signed-token',
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }),
      );
    });
  });

  describe('google state', () => {
    it('issues a state cookie and returns the same value for the URL', () => {
      const { res, cookie } = mockResponse();

      const state = service.issueGoogleState(res);

      expect(state).toHaveLength(64);
      expect(cookie).toHaveBeenCalledWith(
        'oauth_state',
        state,
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });

    it('accepts a matching state and clears the cookie', () => {
      const { res, clearCookie } = mockResponse();

      expect(() =>
        service.verifyGoogleState(mockRequest({ oauth_state: 'abc' }, { state: 'abc' }), res),
      ).not.toThrow();
      expect(clearCookie).toHaveBeenCalledWith('oauth_state');
    });

    it('rejects a mismatched state', () => {
      expect(() =>
        service.verifyGoogleState(
          mockRequest({ oauth_state: 'abc' }, { state: 'not-abc' }),
          mockResponse().res,
        ),
      ).toThrow(new GoogleAuthException('state_mismatch'));
    });

    // Without the cookie there is nothing to compare against, so the callback
    // would otherwise accept any code, which is the login-CSRF the parameter
    // exists to prevent.
    it('rejects a missing state cookie', () => {
      expect(() =>
        service.verifyGoogleState(mockRequest({}, { state: 'abc' }), mockResponse().res),
      ).toThrow(new GoogleAuthException('state_mismatch'));
    });

    it('clears the cookie even when the check fails, so it cannot be replayed', () => {
      const { res, clearCookie } = mockResponse();

      expect(() =>
        service.verifyGoogleState(mockRequest({ oauth_state: 'abc' }, {}), res),
      ).toThrow();
      expect(clearCookie).toHaveBeenCalledWith('oauth_state');
    });
  });
});
