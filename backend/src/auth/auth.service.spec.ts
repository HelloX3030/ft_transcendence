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
import { JwtRefreshPayload } from 'src/types';
import { verifyTOTP } from 'src/utils/otp.utils';
import { AuthService } from './auth.service';
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
  },
  sessions: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn(),
} satisfies Partial<jest.Mocked<JwtService>>;

// Returns the cookie spy alongside the response so assertions never reference
// `res.cookie` as an unbound method.
function mockResponse(): { res: ExpressResponse; cookie: jest.Mock } {
  const cookie = jest.fn();
  return { res: { cookie } as unknown as ExpressResponse, cookie };
}

function mockRequest(): ExpressRequest {
  return { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } } as unknown as ExpressRequest;
}

function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', { code, clientVersion: '5.0.0' });
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

    it('asks for a TOTP code instead of logging in when MFA is active', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      const { res, cookie } = mockResponse();

      const result = await service.login(mockRequest(), loginDto, res);

      expect(result.data).toEqual({ mfaRequired: true, mfaType: 'totp' });
      // No session may be established until the second factor is supplied.
      expect(cookie).not.toHaveBeenCalled();
      expect(mockPrisma.sessions.create).not.toHaveBeenCalled();
    });

    it('completes the login when a valid TOTP code is supplied', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(true);
      const { res, cookie } = mockResponse();

      const result = await service.login(mockRequest(), { ...loginDto, otp: '213846' }, res);

      expect(result.data).toEqual({ mfaRequired: false, mfaType: 'none' });
      expect(cookie).toHaveBeenCalledTimes(2);
    });

    it('rejects an invalid TOTP code', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(false);
      const { res, cookie } = mockResponse();

      await expect(
        service.login(mockRequest(), { ...loginDto, otp: '000000' }, res),
      ).rejects.toThrow(ForbiddenException);
      expect(cookie).not.toHaveBeenCalled();
    });

    it('fails closed when MFA is active but no secret is stored', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ ...totpUser, totpSecret: null });
      const { res, cookie } = mockResponse();

      await expect(
        service.login(mockRequest(), { ...loginDto, otp: '213846' }, res),
      ).rejects.toThrow(InternalServerErrorException);
      expect(cookie).not.toHaveBeenCalled();
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
});
