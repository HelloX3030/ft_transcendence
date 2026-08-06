import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { UpdateUserDto } from './dto';
import { ME_SELECT, PUBLIC_SELECT, UsersService } from './users.service';
import { verifyTOTP } from 'src/utils/otp.utils';
import { CRYPTO_FORMAT, decryptSecret } from 'src/utils/crypto.utils';

jest.mock('src/utils/otp.utils');
const mockVerifyTOTP = jest.mocked(verifyTOTP);

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  avatarFileId: null,
  language: 'en',
  role: 'user',
};

const mockPublicUser = { id: 1, username: 'testuser', avatarFileId: null };

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
  files: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
} satisfies {
  users: Partial<jest.Mocked<PrismaService['users']>>;
  files: Partial<jest.Mocked<PrismaService['files']>>;
  $transaction: unknown;
};

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
  getObject: jest.fn(),
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
    // uploadAvatar writes the files row and the users pointer in one transaction;
    // running the callback against the same mocks keeps the assertions on it.
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma));
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
      mockPrisma.users.findUnique.mockResolvedValue({ avatarFile: null });
      mockPrisma.files.create.mockResolvedValue({ id: 9 });
      mockPrisma.users.update.mockResolvedValue(mockUser);

      await service.uploadAvatar(1, file);

      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^1-\d+-[0-9a-f]{8}\.png$/),
        pngBytes,
        'image/png',
      );
      expect(mockPrisma.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 1,
            mimetype: 'image/png',
            size: pngBytes.length,
            kind: 'avatar',
          }) as object,
        }),
      );
      expect(mockPrisma.users.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { avatarFileId: 9 } }),
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

    it('deletes the just-uploaded object when the DB write fails', async () => {
      const error = prismaError('P2025');
      mockPrisma.users.findUnique.mockResolvedValue({ avatarFile: null });
      mockPrisma.files.create.mockRejectedValue(error);

      await expect(service.uploadAvatar(1, file)).rejects.toThrow(error);
      expect(mockStorage.delete).toHaveBeenCalledWith(
        expect.stringMatching(/^1-\d+-[0-9a-f]{8}\.png$/),
      );
    });

    it('discards the replaced avatar, row and object', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({
        avatarFile: { id: 4, key: '1-old.jpg' },
      });
      mockPrisma.files.create.mockResolvedValue({ id: 9 });
      mockPrisma.users.update.mockResolvedValue({ ...mockUser, avatarFileId: 9 });

      await service.uploadAvatar(1, file);

      expect(mockPrisma.files.delete).toHaveBeenCalledWith({ where: { id: 4 } });
      expect(mockStorage.delete).toHaveBeenCalledWith('1-old.jpg');
    });

    it('deletes nothing when the user had no avatar', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ avatarFile: null });
      mockPrisma.files.create.mockResolvedValue({ id: 9 });
      mockPrisma.users.update.mockResolvedValue({ ...mockUser, avatarFileId: 9 });

      await service.uploadAvatar(1, file);

      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteAvatar', () => {
    it('deletes the row and the object, and reports the cleared profile', async () => {
      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ avatarFile: { id: 4, key: '1-old.jpg' } })
        .mockResolvedValueOnce({ ...mockUser, avatarFileId: null });

      const result = await service.deleteAvatar(1);

      expect(mockPrisma.files.delete).toHaveBeenCalledWith({ where: { id: 4 } });
      expect(mockStorage.delete).toHaveBeenCalledWith('1-old.jpg');
      expect(result.data).toMatchObject({ avatarFileId: null });
    });

    it('404s when there is no avatar to delete', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ avatarFile: null });

      await expect(service.deleteAvatar(1)).rejects.toThrow(NotFoundException);
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteMe', () => {
    it('returns account deleted message on success', async () => {
      mockPrisma.files.findMany.mockResolvedValue([]);
      mockPrisma.users.delete.mockResolvedValue(undefined);

      const result = await service.deleteMe(1);

      expect(mockPrisma.users.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ success: true, message: 'Account deleted', data: null });
    });

    it('removes every object the user owned', async () => {
      // The rows go with the user via cascade, but the objects have no such
      // relationship and would be leaked without this.
      mockPrisma.files.findMany.mockResolvedValue([{ key: '1-old.jpg' }, { key: '1-older.png' }]);
      mockPrisma.users.delete.mockResolvedValue(undefined);

      await service.deleteMe(1);

      expect(mockStorage.delete).toHaveBeenCalledWith('1-old.jpg');
      expect(mockStorage.delete).toHaveBeenCalledWith('1-older.png');
    });

    it('does not call delete when the user owned no files', async () => {
      mockPrisma.files.findMany.mockResolvedValue([]);
      mockPrisma.users.delete.mockResolvedValue(undefined);

      await service.deleteMe(1);

      expect(mockStorage.delete).not.toHaveBeenCalled();
    });

    it('throws a Prisma P2025 error when deleting a non-existent user', async () => {
      mockPrisma.files.findMany.mockResolvedValue([]);
      mockPrisma.users.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.deleteMe(1)).rejects.toThrow();
    });

    it('re-throws non-P2025 errors', async () => {
      mockPrisma.files.findMany.mockResolvedValue([]);
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

    beforeEach(() => {
      process.env.MFA_KEY = TEST_KEY;
      mockPrisma.users.findUnique.mockResolvedValue({
        username: 'testuser',
        totpActive: false,
      });
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });
    });

    afterAll(() => {
      if (originalKey === undefined) delete process.env.MFA_KEY;
      else process.env.MFA_KEY = originalKey;
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

    it('stores the secret encrypted in the authenticated `iv:tag:cipher` format', async () => {
      await service.createTOTP(1);

      const stored = storedSecretArg();
      const ivHex = CRYPTO_FORMAT.IV_BYTES * 2;
      const tagHex = CRYPTO_FORMAT.AUTH_TAG_BYTES * 2;
      expect(stored).toMatch(new RegExp(`^[0-9a-f]{${ivHex}}:[0-9a-f]{${tagHex}}:[0-9a-f]+$`));
      expect(decryptSecret(stored)).toMatch(/^[A-Z2-7]+$/); // base32
    });

    it('throws NotFoundException when the user does not exist', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.createTOTP(999)).rejects.toThrow(NotFoundException);
    });

    // The issuer is the name the authenticator app shows next to the code.
    // Nothing asserted on it before, which is how a stale one survived here.
    it('issues the TOTP under the app name', async () => {
      const generateQRCode = jest.spyOn(service, 'generateQRCode');

      await service.createTOTP(1);

      const uri = new URL(generateQRCode.mock.calls[0][0]);
      expect(uri.searchParams.get('issuer')).toBe('CineMates');
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
    const activeUser = { totpSecret: 'iv:cipher', totpActive: true };
    const COUNTER = 58_000_000;

    it('clears both the secret and the active flag for a valid code', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(activeUser);
      mockVerifyTOTP.mockReturnValue(COUNTER);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteTOTP(1, '213846');

      expect(result.success).toBe(true);
      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: {
          id: 1,
          totpActive: true,
          OR: [{ totpLastCounter: null }, { totpLastCounter: { lt: COUNTER } }],
        },
        data: { totpSecret: null, totpActive: false, totpLastCounter: COUNTER },
      });
    });

    // The check and the write are one statement, so a code being spent
    // concurrently on a login cannot also disable 2FA.
    it('burns the code in the same statement that disables 2FA', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(activeUser);
      mockVerifyTOTP.mockReturnValue(COUNTER);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      await service.deleteTOTP(1, '213846');

      const arg = (mockPrisma.users.updateMany.mock.calls as unknown[][])[0][0] as {
        data: { totpLastCounter?: number; totpActive?: boolean };
      };
      expect(arg.data.totpLastCounter).toBe(COUNTER);
      expect(arg.data.totpActive).toBe(false);
    });

    it('rejects a wrong code without touching the row', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(activeUser);
      mockVerifyTOTP.mockReturnValue(null);

      await expect(service.deleteTOTP(1, '000000')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
    });

    // count === 0 means the counter filter did not match: the code verified, but
    // it had already been spent inside its ~90-second acceptance window.
    it('rejects a code at or below the last spent counter', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(activeUser);
      mockVerifyTOTP.mockReturnValue(COUNTER);
      mockPrisma.users.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteTOTP(1, '213846')).rejects.toThrow(BadRequestException);
    });

    it('rejects an omitted code while 2FA is active', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(activeUser);

      await expect(service.deleteTOTP(1)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.users.updateMany).not.toHaveBeenCalled();
      expect(mockVerifyTOTP).not.toHaveBeenCalled();
    });

    // An abandoned setup has to stay clearable without a code: nothing has ever
    // been protected by it, the user never scanned the QR, and createTOTP refuses
    // to replace an existing secret.
    it('clears an abandoned, never-activated secret without a code', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ totpSecret: 'iv:cipher', totpActive: false });
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteTOTP(1);

      expect(result.success).toBe(true);
      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: { id: 1, totpActive: false },
        data: { totpSecret: null },
      });
      expect(mockVerifyTOTP).not.toHaveBeenCalled();
    });

    it('is a no-op on an account that never had TOTP', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ totpSecret: null, totpActive: false });
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteTOTP(1);

      expect(result.success).toBe(true);
    });

    // Active with no secret can never clear MFA at login either, so there is no
    // code that could be demanded — clearing the flag is the only way out.
    it('repairs an active row whose secret is missing instead of crashing', async () => {
      mockPrisma.users.findUnique.mockResolvedValue({ totpSecret: null, totpActive: true });
      mockPrisma.users.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteTOTP(1);

      expect(result.success).toBe(true);
      expect(mockPrisma.users.updateMany).toHaveBeenCalledWith({
        where: { id: 1, totpActive: true, totpSecret: null },
        data: { totpActive: false },
      });
    });

    it('throws NotFoundException for an unknown user', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(service.deleteTOTP(1, '213846')).rejects.toThrow(NotFoundException);
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
