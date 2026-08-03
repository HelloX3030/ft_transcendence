import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { GoogleProfile, JwtRefreshPayload } from 'src/types';
import { verifyTOTP } from 'src/utils/otp.utils';
import { AuthService, generateUsernameStem, GoogleAuthException } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

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
    create: jest.fn(),
  },
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
  language: 'en',
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
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

      expect(result).toEqual({
        success: true,
        message: 'User registered successfully',
        data: null,
      });
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
    // failure (403) — see the register status-code change alongside A6.
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

      expect(result.data).toEqual({ mfaRequired: false, mfaType: 'none' });
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
    // caught before the call — a clean 403, not a stack trace.
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
      // Derived, so a challenge token can never validate as an access token —
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

      expect(result.data).toEqual({ mfaRequired: false, mfaType: 'none' });
      expect(cookie).toHaveBeenCalledTimes(2);
    });

    it('never asks for the password again', async () => {
      await service.verifyMfa(mockRequest(), dto, mockResponse().res);

      expect(mockArgon2.verify).not.toHaveBeenCalled();
    });

    // The Google flow ends in a redirect, so the client never sees a body to
    // hold the challenge token in — the backend leaves it in a cookie instead.
    it('falls back to the mfa_token cookie when the body omits it', async () => {
      const { res, cookie } = mockResponse();

      const result = await service.verifyMfa(
        mockRequest({ mfa_token: 'cookie-token' }),
        { otp: dto.otp },
        res,
      );

      expect(mockJwt.verifyAsync).toHaveBeenCalledWith('cookie-token', expect.any(Object));
      expect(result.data).toEqual({ mfaRequired: false, mfaType: 'none' });
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
    });

    it('issues new tokens and sets both cookies on a valid session', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      const { res, cookie } = mockResponse();

      const result = await service.refresh(mockPayload, res);

      expect(result).toEqual({ success: true, message: 'Token refreshed', data: null });
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

    // A5 — the session must belong to the subject the refresh token claims to be.
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
  });

  describe('generateUsernameStem', () => {
    it('lowercases and strips the local part to [a-z0-9_]', () => {
      // Separators go, the characters around them stay — plus-addressing is not
      // unwrapped, it is simply stripped like any other punctuation.
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
      locale: 'de-DE',
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
      // Mapped from Google's locale prefix; the column is non-null with no default.
      expect(created.data.language).toBe('de');
      // onboardingCompleted defaults to false, which is what routes the new user
      // through /onboarding exactly like a local signup.
      expect(created.data.onboardingCompleted).toBeUndefined();
    });

    it('defaults an unrecognised locale to English', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);
      mockPrisma.users.create.mockResolvedValue(plainUser);

      await service.googleLogin(
        mockRequest(),
        { ...googleProfile, locale: 'fr-FR' },
        mockResponse().res,
      );

      const created = (mockPrisma.users.create.mock.calls as unknown[][])[0][0] as {
        data: { language: string };
      };
      expect(created.data.language).toBe('en');
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
    // would otherwise accept any code — the login-CSRF the parameter prevents.
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
