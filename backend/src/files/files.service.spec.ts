import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { FilesService } from './files.service';

const mockPrisma = {
  files: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
} satisfies { files: Partial<jest.Mocked<PrismaService['files']>> };

const mockStorage = {
  getObject: jest.fn(),
  delete: jest.fn(),
} satisfies Partial<jest.Mocked<StorageService>>;

const OWNER_ID = 1;
const OTHER_ID = 2;

const avatarRow = {
  key: '1-123-abcd.png',
  mimetype: 'image/png',
  kind: 'avatar' as const,
};

describe('FilesService', () => {
  let service: FilesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    jest.clearAllMocks();
  });

  describe('read', () => {
    it('serves the stored mimetype, not anything the request could influence', async () => {
      mockPrisma.files.findUnique.mockResolvedValue(avatarRow);
      mockStorage.getObject.mockResolvedValue({
        body: Readable.from(['bytes']),
        contentLength: 5,
      });

      const result = await service.read(10);

      expect(mockStorage.getObject).toHaveBeenCalledWith('1-123-abcd.png');
      expect(result.mimetype).toBe('image/png');
      expect(result.contentLength).toBe(5);
    });

    it('lets any authenticated user read an avatar, not just its owner', async () => {
      mockPrisma.files.findUnique.mockResolvedValue(avatarRow);
      mockStorage.getObject.mockResolvedValue({ body: Readable.from([]), contentLength: 0 });

      await expect(service.read(10)).resolves.toBeDefined();
    });

    it('404s on an id that does not exist', async () => {
      mockPrisma.files.findUnique.mockResolvedValue(null);

      await expect(service.read(999)).rejects.toThrow(NotFoundException);
      expect(mockStorage.getObject).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the row and then the object', async () => {
      mockPrisma.files.findUnique.mockResolvedValue({ key: '1-old.png', ownerId: OWNER_ID });

      await service.remove(10, OWNER_ID);

      expect(mockPrisma.files.delete).toHaveBeenCalledWith({ where: { id: 10 } });
      expect(mockStorage.delete).toHaveBeenCalledWith('1-old.png');
    });

    it('refuses a non-owner and leaves the object untouched', async () => {
      mockPrisma.files.findUnique.mockResolvedValue({ key: '1-old.png', ownerId: OWNER_ID });

      await expect(service.remove(10, OTHER_ID)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.files.delete).not.toHaveBeenCalled();
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });

    it('404s on an id that does not exist', async () => {
      mockPrisma.files.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, OWNER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('purgeOrphans', () => {
    it('deletes unreferenced rows past the window, and their objects', async () => {
      mockPrisma.files.findMany.mockResolvedValue([
        { id: 1, key: 'a.png' },
        { id: 2, key: 'b.png' },
      ]);

      await service.purgeOrphans();

      expect(mockPrisma.files.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ avatarOf: { none: {} } }) as object,
        }),
      );
      expect(mockPrisma.files.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } } });
      expect(mockStorage.delete).toHaveBeenCalledWith('a.png');
      expect(mockStorage.delete).toHaveBeenCalledWith('b.png');
    });

    it('does no work when there are no orphans', async () => {
      mockPrisma.files.findMany.mockResolvedValue([]);

      await service.purgeOrphans();

      expect(mockPrisma.files.deleteMany).not.toHaveBeenCalled();
    });

    it('swallows failures: a broken sweep must not take down the scheduler', async () => {
      mockPrisma.files.findMany.mockRejectedValue(new Error('db down'));

      await expect(service.purgeOrphans()).resolves.toBeUndefined();
    });
  });
});
