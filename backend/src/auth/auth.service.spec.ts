import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { LoginDto, RegisterDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { language_code, user_role } from '@prisma/client';
import * as argon2 from 'argon2';
import { JwtRefreshPayload } from 'src/types';

jest.useFakeTimers();
jest.setSystemTime(new Date('2026-06-01T12:00:00Z'));

const mockUser = {
  id: 1,
  username: 'testuser',
  password: 'hashed-password',
  email: 'test@example.com',
  image: null,
  language: language_code.en,
  role: user_role.user,
  createdAt: new Date(),
};

const mockPrisma = {
  users: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  sessions: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as jest.Mocked<PrismaService>;

const mockReq = {
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'jest-test-agent',
  },
} as unknown as ExpressRequest;

const mockSession = {
  id: 1,
  userId: mockUser.id,
  sessionHash: 'session-hash',
  ipAddress: mockReq.ip as string,
  userAgent: mockReq.headers['user-agent'] as string,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
  createdAt: new Date(),
};

const mockRegisterDto: RegisterDto = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Test123!',
  language: 'en',
};

const mockLoginDto: LoginDto = {
  email: 'test@example.com',
  password: 'Test123!',
};

const mockRes = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as ExpressResponse;

const mockRefreshPayload: JwtRefreshPayload = {
  sub: 1,
  sessionId: 1,
  session: 'session-hash',
};

const mockJwt = { signAsync: jest.fn() };

jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
}));

const mockHash = argon2.hash as jest.MockedFunction<typeof argon2.hash>;
const mockVerify = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

mockJwt.signAsync.mockReturnValue('mock-jwt');

function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', { code, clientVersion: '5.0.0' });
}

function checkCookies(mockRes: ExpressResponse) {
  expect(mockRes.cookie).toHaveBeenNthCalledWith(1, 'access_token', 'mock-jwt', expect.any(Object));
  expect(mockRes.cookie).toHaveBeenNthCalledWith(
    2,
    'refresh_token',
    'mock-jwt',
    expect.any(Object),
  );
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

  describe('register', () => {
    it('returns registered successfully and sets the Cookies with the JWTs', async () => {
      mockPrisma.users.create.mockResolvedValue(mockUser);
      mockPrisma.sessions.create.mockResolvedValue(mockSession);
      mockHash.mockResolvedValue('hashed-password');

      const result = await service.register(mockReq, mockRegisterDto, mockRes);

      expect(mockPrisma.users.create).toHaveBeenCalledWith({
        data: {
          username: mockRegisterDto.username,
          email: mockRegisterDto.email,
          password: mockUser.password,
          language: mockRegisterDto.language,
          role: 'user',
        },
      });
      checkCookies(mockRes);
      expect(result.message).toBe('User registered successfully');
    });

    it('throws ForbiddenException when credentials are already taken (P2002)', async () => {
      mockPrisma.users.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.register(mockReq, mockRegisterDto, mockRes)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when provided value is too long (P2000)', async () => {
      mockPrisma.users.create.mockRejectedValue(prismaError('P2000'));

      await expect(service.register(mockReq, mockRegisterDto, mockRes)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws the same error as Prisma if no explicit error message is to be displayed (P6009)', async () => {
      mockPrisma.users.create.mockRejectedValue(prismaError('P6009'));
      const error = prismaError('P6009');
      await expect(service.register(mockReq, mockRegisterDto, mockRes)).rejects.toThrow(error);
    });
  });

  describe('login', () => {
    it('returns login successfully and sets the Cookies with the JWTs', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      mockVerify.mockResolvedValue(true);

      const result = await service.login(mockReq, mockLoginDto, mockRes);
      checkCookies(mockRes);
      expect(result.message).toBe('Login successful');
    });

    it('should throw ForbiddenException when user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.login(mockReq, mockLoginDto, mockRes)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when password does not match', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      mockVerify.mockResolvedValue(false);

      await expect(service.login(mockReq, mockLoginDto, mockRes)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('refresh', () => {
    it('returns Token refreshed and sets the Cookies with the JWTs', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockVerify.mockResolvedValue(true);
      mockHash.mockResolvedValue('session-hash');

      const result = await service.refresh(mockRefreshPayload, mockRes);

      checkCookies(mockRes);
      expect(result.message).toBe('Token refreshed');
    });

    it('should throw ForbiddenException when session does not exist', async () => {
      mockPrisma.sessions.findUnique.mockResolvedValue(null);

      await expect(service.refresh(mockRefreshPayload, mockRes)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when sessionId does not match', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);
      mockPrisma.sessions.findUnique.mockResolvedValue(mockSession);
      mockVerify.mockResolvedValue(false);
      mockHash.mockResolvedValue('session-hash');

      await expect(service.refresh(mockRefreshPayload, mockRes)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('logout', () => {
    it('should delete session, clear cookies and return success message', async () => {
      const result = await service.logout(mockRefreshPayload, mockRes);

      expect(mockPrisma.sessions.delete).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
      });

      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token');

      expect(result).toEqual({
        message: 'Logged out',
      });
    });
  });

  describe('createRefreshJwt', () => {
    it('returns a refresh JWT', async () => {
      mockPrisma.sessions.create.mockResolvedValue(mockSession);

      const result = await service.createRefreshJwt(mockUser.id, mockReq);

      expect(mockPrisma.sessions.create).toHaveBeenCalledWith({
        data: {
          userId: mockSession.id,
          sessionHash: expect.any(String),
          ipAddress: mockSession.ipAddress,
          userAgent: mockSession.userAgent,
          expiresAt: mockSession.expiresAt,
        },
      });
      expect(result.refresh_token).toBe('mock-jwt');
    });
  });
});
