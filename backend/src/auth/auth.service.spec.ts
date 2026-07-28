import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import type { Response as ExpressResponse } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtRefreshPayload } from 'src/types';
import { AuthService } from './auth.service';

jest.mock('argon2');
const mockArgon2 = jest.mocked(argon2);

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
  },
  sessions: {
    findUnique: jest.fn(),
    update: jest.fn(),
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
