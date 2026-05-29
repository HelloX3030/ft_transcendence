import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UpdateUserDto } from './dto';
import { ME_SELECT, PUBLIC_SELECT, UsersService } from './users.service';

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  image: null,
  language: 'en',
  role: 'user',
};

const mockPublicUser = { id: 1, username: 'testuser', image: null };

const mockPrisma = {
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', { code, clientVersion: '5.0.0' });
}

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: { upload: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMe', () => {
    it('returns the full user profile for the given id', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(1);

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ME_SELECT,
      });
      expect(result).toEqual(mockUser);
    });

    it('returns null when user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      const result = await service.getMe(999);

      expect(result).toBeNull();
    });
  });

  describe('updateMe', () => {
    it('returns updated user profile on success', async () => {
      const dto: UpdateUserDto = { username: 'newname' };
      const updated = { ...mockUser, username: 'newname' };
      mockPrisma.users.update.mockResolvedValue(updated);

      const result = await service.updateMe(1, dto);

      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: dto,
        select: ME_SELECT,
      });
      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException when username is already taken (P2002)', async () => {
      mockPrisma.users.update.mockRejectedValue(prismaError('P2002'));

      await expect(service.updateMe(1, { username: 'taken' })).rejects.toThrow(ForbiddenException);
    });

    it('re-throws non-P2002 Prisma errors', async () => {
      const error = prismaError('P2025');
      mockPrisma.users.update.mockRejectedValue(error);

      await expect(service.updateMe(1, { username: 'x' })).rejects.toThrow(error);
    });
  });

  describe('deleteMe', () => {
    it('returns account deleted message on success', async () => {
      mockPrisma.users.delete.mockResolvedValue(undefined);

      const result = await service.deleteMe(1);

      expect(mockPrisma.users.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ message: 'Account deleted' });
    });

    it('returns account deleted message when user does not exist (P2025)', async () => {
      mockPrisma.users.delete.mockRejectedValue(prismaError('P2025'));

      const result = await service.deleteMe(999);

      expect(result).toEqual({ message: 'Account deleted' });
    });

    it('re-throws non-P2025 errors', async () => {
      const error = new Error('DB connection failed');
      mockPrisma.users.delete.mockRejectedValue(error);

      await expect(service.deleteMe(1)).rejects.toThrow('DB connection failed');
    });
  });

  describe('getUser', () => {
    it('returns public profile when user exists', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(mockPublicUser);

      const result = await service.getUser(1);

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: PUBLIC_SELECT,
      });
      expect(result).toEqual(mockPublicUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.getUser(999)).rejects.toThrow(NotFoundException);
    });
  });
});
