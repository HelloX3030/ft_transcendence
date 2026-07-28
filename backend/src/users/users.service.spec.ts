import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UpdateUserDto } from './dto';
import { ME_SELECT, PUBLIC_SELECT, UsersService } from './users.service';
import { verifyTOTP } from 'src/utils/otp.utils';
import { decryptSecret } from 'src/utils/crypto.utils';

jest.mock('src/utils/otp.utils');
const mockVerifyTOTP = jest.mocked(verifyTOTP);

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
        expect.stringMatching(/^1-\d+-[0-9a-f]{8}\.png$/),
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

    it('deletes the just-uploaded object when the DB update fails', async () => {
      const error = prismaError('P2025');
      mockPrisma.users.findUnique.mockResolvedValue({ image: null });
      mockStorage.extractKey.mockReturnValue(null);
      mockStorage.upload.mockResolvedValue('http://localhost:9000/avatars/1-new.png');
      mockPrisma.users.update.mockRejectedValue(error);

      await expect(service.uploadAvatar(1, file)).rejects.toThrow(error);
      expect(mockStorage.delete).toHaveBeenCalledWith(
        expect.stringMatching(/^1-\d+-[0-9a-f]{8}\.png$/),
      );
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

  describe('createTOTP', () => {
    // The prisma mock is deliberately untyped, so read its recorded call through
    // a narrow shape rather than sprinkling `any` access across the assertions.
    type UpdateManyArg = { where: unknown; data: { totpSecret: string } };

    function updateManyArg(): UpdateManyArg {
      return (mockPrisma.users.updateMany.mock.calls as unknown[][])[0][0] as UpdateManyArg;
    }

    function storedSecretArg(): string {
      return updateManyArg().data.totpSecret;
    }

    const TEST_KEY = 'a3f1c9d4b2e8f0c1d3a4b5c6e7f8091a2b3c4d5e6f7081920a1b2c3d4e5f6071';
    const originalKey = process.env.MFA_KEY;
    const originalAppName = process.env.APP_NAME;

    beforeEach(() => {
      process.env.MFA_KEY = TEST_KEY;
      process.env.APP_NAME = 'TrailerTinder';
      mockPrisma.users.findUnique.mockResolvedValue({
        username: 'testuser',
        totpActive: false,
      });
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
    });

    afterAll(() => {
      if (originalKey === undefined) delete process.env.MFA_KEY;
      else process.env.MFA_KEY = originalKey;
      if (originalAppName === undefined) delete process.env.APP_NAME;
      else process.env.APP_NAME = originalAppName;
    });

    it('returns a QR code', async () => {
      const result = await service.createTOTP(1);

      expect(result.data).toContain('<svg');
    });

    // A3 — the plaintext secret is deliberately never sent to the client.
    it('never returns the plaintext secret', async () => {
      const result = await service.createTOTP(1);

      const plaintext = decryptSecret(storedSecretArg());
      expect(JSON.stringify(result)).not.toContain(plaintext);
    });

    it('stores the secret encrypted in the `iv:cipher` format', async () => {
      await service.createTOTP(1);

      const stored = storedSecretArg();
      expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
      expect(decryptSecret(stored)).toMatch(/^[A-Z2-7]+$/); // base32
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.createTOTP(999)).rejects.toThrow(NotFoundException);
    });

    it('throws when APP_NAME is not configured', async () => {
      delete process.env.APP_NAME;

      await expect(service.createTOTP(1)).rejects.toThrow(InternalServerErrorException);
      expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
    });

    // The overwrite guard: a re-setup must not clobber an already-active secret.
    it('throws ConflictException when TOTP is already active', async () => {
      mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.createTOTP(1)).rejects.toThrow(ConflictException);
    });

    it('scopes the write to a user without active TOTP', async () => {
      await service.createTOTP(1);

      expect(updateManyArg().where).toEqual({ id: 1, totpActive: false });
      expect(typeof storedSecretArg()).toBe('string');
    });
  });

  describe('deleteTOTP', () => {
    it('clears both the secret and the active flag', async () => {
      mockPrisma.users.update.mockResolvedValue(mockUser);

      await service.deleteTOTP(1);

      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { totpSecret: null, totpActive: false },
      });
    });
  });

  describe('activateTOTP', () => {
    const totpUser = { totpSecret: 'iv:cipher', totpActive: false };

    it('activates a pending secret and reports success', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(58_000_000);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.activateTOTP(1, '213846');

      expect(result.success).toBe(true);
    });

    // The update must only match a not-yet-active row, so re-posting a valid
    // code to an already-active account conflicts instead of succeeding.
    it('scopes the update to a currently inactive secret', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(58_000_000);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      await service.activateTOTP(1, '213846');

      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: { id: 1, totpSecret: totpUser.totpSecret, totpActive: false },
        data: { totpActive: true, totpLastCounter: 58_000_000 },
      });
    });

    it('burns the activating code so it cannot be replayed against login', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(58_000_000);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      await service.activateTOTP(1, '213846');

      const arg = (mockPrisma.users.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { totpLastCounter?: number };
      };
      expect(arg.data.totpLastCounter).toBe(58_000_000);
    });

    it('throws ConflictException when the secret is already active', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(58_000_000);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.activateTOTP(1, '213846')).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when no TOTP secret is set', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ totpSecret: null, totpActive: false });

      await expect(service.activateTOTP(1, '213846')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on an invalid code without touching the row', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(totpUser);
      mockVerifyTOTP.mockReturnValue(null);

      await expect(service.activateTOTP(1, '000000')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
    });
  });
});
