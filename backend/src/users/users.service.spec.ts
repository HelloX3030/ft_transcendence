import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

// PrismaService inherits a large generated client; only type the slice this service uses.
const mockPrisma = {
  users: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
} satisfies { users: Partial<jest.Mocked<PrismaService['users']>> };

function prismaError(code: string, target?: string[]): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError('error', {
    code,
    clientVersion: '5.0.0',
    meta: target ? { target } : undefined,
  });
}

const mockStorage = {
  upload: jest.fn(),
  delete: jest.fn(),
  extractKey: jest.fn(),
} satisfies Partial<jest.Mocked<StorageService>>;

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
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
      expect(result.data).toEqual(mockUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeOnboarding', () => {
    const dto = { movieIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };

    it('stamps preferences and returns the profile on first onboarding', async () => {
      const onboarded = { ...mockUser, onboardingCompleted: true };
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.users.findUnique.mockResolvedValue(onboarded);

      const result = await service.completeOnboarding(1, dto);

      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: { id: 1, onboardingCompleted: false },
        data: expect.objectContaining({ onboardingCompleted: true }) as object,
      });
      expect(result.data).toEqual(onboarded);
    });

    it('throws ConflictException and leaves preferences untouched on a repeat call', async () => {
      mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.users.findUnique.mockResolvedValue({
        ...mockUser,
        onboardingCompleted: true,
      });

      await expect(service.completeOnboarding(1, dto)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the user no longer exists', async () => {
      mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.completeOnboarding(999, dto)).rejects.toThrow(NotFoundException);
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
      expect(result.data).toEqual(updated);
    });

    it('throws ConflictException when username is already taken (P2002)', async () => {
      mockPrisma.users.update.mockRejectedValue(prismaError('P2002', ['username']));

      await expect(service.updateMe(1, { username: 'taken' })).rejects.toThrow(
        new ConflictException('Username already taken'),
      );
    });

    it('names the email field when the collision is on email (P2002)', async () => {
      mockPrisma.users.update.mockRejectedValue(prismaError('P2002', ['email']));

      await expect(service.updateMe(1, { email: 'taken@example.com' })).rejects.toThrow(
        new ConflictException('Email already taken'),
      );
    });

    it('re-throws non-P2002 Prisma errors', async () => {
      const error = prismaError('P2025');
      mockPrisma.users.update.mockRejectedValue(error);

      await expect(service.updateMe(1, { username: 'x' })).rejects.toThrow(error);
    });
  });

  describe('uploadAvatar', () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const file = {
      originalname: 'photo.jpg',
      buffer: pngBytes,
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    it('stores the sniffed type and extension, ignoring the client-supplied ones', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ image: null });
      mockStorage.extractKey.mockReturnValue(null);
      mockStorage.upload.mockResolvedValue('http://localhost:9000/avatars/1-new.png');
      mockPrisma.users.update.mockResolvedValue(mockUser);

      await service.uploadAvatar(1, file);

      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^1-\d+\.png$/),
        pngBytes,
        'image/png',
      );
    });

    it('rejects an SVG that declares an image mimetype', async () => {
      const svg = {
        originalname: 'x.png',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      await expect(service.uploadAvatar(1, svg)).rejects.toThrow(BadRequestException);
      expect(mockStorage.upload).not.toHaveBeenCalled();
    });

    it('deletes old MinIO avatar when user has one', async () => {
      const minioUrl = 'http://localhost:9000/avatars/1-old.jpg';
      mockPrisma.users.findUnique.mockResolvedValue({ image: minioUrl });
      mockStorage.extractKey.mockReturnValue('1-old.jpg');
      mockStorage.upload.mockResolvedValue('http://localhost:9000/avatars/1-new.jpg');
      mockPrisma.users.update.mockResolvedValue({
        ...mockUser,
        image: 'http://localhost:9000/avatars/1-new.jpg',
      });

      await service.uploadAvatar(1, file);

      expect(mockStorage.delete).toHaveBeenCalledWith('1-old.jpg');
    });

    it('does not call delete when user has no MinIO avatar', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({
        image: 'https://oauth.example.com/avatar.jpg',
      });
      mockStorage.extractKey.mockReturnValue(null);
      mockStorage.upload.mockResolvedValue('http://localhost:9000/avatars/1-new.jpg');
      mockPrisma.users.update.mockResolvedValue({
        ...mockUser,
        image: 'http://localhost:9000/avatars/1-new.jpg',
      });

      await service.uploadAvatar(1, file);

      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteMe', () => {
    it('returns account deleted message on success', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ image: null });
      mockStorage.extractKey.mockReturnValue(null);
      mockPrisma.users.delete.mockResolvedValue(undefined);

      const result = await service.deleteMe(1);

      expect(mockPrisma.users.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ success: true, message: 'Account deleted', data: null });
    });

    it('deletes MinIO avatar when user has one', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({
        image: 'http://localhost:9000/avatars/1-old.jpg',
      });
      mockStorage.extractKey.mockReturnValue('1-old.jpg');
      mockPrisma.users.delete.mockResolvedValue(undefined);

      await service.deleteMe(1);

      expect(mockStorage.delete).toHaveBeenCalledWith('1-old.jpg');
    });

    it('does not call delete when user has no avatar', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ image: null });
      mockStorage.extractKey.mockReturnValue(null);
      mockPrisma.users.delete.mockResolvedValue(undefined);

      await service.deleteMe(1);

      expect(mockStorage.delete).not.toHaveBeenCalled();
    });

    it('throws a Prisma P2025 error when deleting a non-existent user', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ image: null });
      mockStorage.extractKey.mockReturnValue(null);
      mockPrisma.users.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.deleteMe(1)).rejects.toThrow();
    });

    it('re-throws non-P2025 errors', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ image: null });
      mockStorage.extractKey.mockReturnValue(null);
      const error = new Error('DB connection failed');
      mockPrisma.users.delete.mockRejectedValue(error);

      await expect(service.deleteMe(1)).rejects.toThrow('DB connection failed');
    });
  });

  describe('searchUsers', () => {
    it('returns a paginated case-insensitive substring match, excluding the requester', async () => {
      const matches = [mockPublicUser];
      mockPrisma.users.count.mockResolvedValue(1);
      mockPrisma.users.findMany.mockResolvedValue(matches);

      const result = await service.searchUsers(42, { query: 'test', page: 2, limit: 10 });

      const expectedWhere = {
        username: { contains: 'test', mode: 'insensitive' },
        id: { not: 42 },
      };
      expect(mockPrisma.users.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(mockPrisma.users.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: PUBLIC_SELECT,
        orderBy: { username: 'asc' },
        skip: 10,
        take: 10,
      });
      expect(result.data).toEqual({ page: 2, limit: 10, total: 1, results: matches });
    });

    it('returns an empty result set when nothing matches', async () => {
      mockPrisma.users.count.mockResolvedValue(0);
      mockPrisma.users.findMany.mockResolvedValue([]);

      const result = await service.searchUsers(1, { query: 'zzz', page: 1, limit: 20 });

      expect(result.data).toEqual({ page: 1, limit: 20, total: 0, results: [] });
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
      expect(result.data).toEqual(mockPublicUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.getUser(999)).rejects.toThrow(NotFoundException);
    });
  });
});
