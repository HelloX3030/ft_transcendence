import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { notifications } from '@prisma/client';
import { NotifyService } from 'src/notify/notify.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { daysAgo, MAX_RETENTION_DAYS, READ_RETENTION_DAYS } from 'src/retention.config';

const mockPrisma = {
  notifications: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockNotifyService = {
  sendEvent: jest.fn(),
} satisfies Partial<jest.Mocked<NotifyService>>;

const NOW = new Date(1_730_000_000_000);

function row(overrides: Partial<notifications> = {}): notifications {
  return {
    id: 1,
    userId: 10,
    type: 'friend_request_created',
    actorId: 7,
    entityId: null,
    params: { actorUsername: 'alice' },
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotifyService, useValue: mockNotifyService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  describe('create', () => {
    it('persists the row before emitting, and never checks presence', async () => {
      mockPrisma.notifications.create.mockResolvedValue({ id: 42, createdAt: NOW });

      await service.create({
        userId: 10,
        type: 'friend_request_created',
        actorId: 7,
        params: { actorUsername: 'alice' },
      });

      expect(mockPrisma.notifications.create).toHaveBeenCalledWith({
        data: {
          userId: 10,
          type: 'friend_request_created',
          actorId: 7,
          entityId: null,
          params: { actorUsername: 'alice' },
        },
        select: { id: true, createdAt: true },
      });
      expect(mockNotifyService.sendEvent).toHaveBeenCalledWith(10, {
        type: 'friend.request.created',
        actorId: 7,
        entityId: null,
        params: { actorUsername: 'alice' },
        notificationId: 42,
        at: NOW.getTime(),
      });
    });

    it('translates the database enum into the dotted wire type', async () => {
      mockPrisma.notifications.create.mockResolvedValue({ id: 1, createdAt: NOW });

      await service.create({ userId: 10, type: 'watchlist_movie_added', entityId: 3 });

      expect(mockNotifyService.sendEvent).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ type: 'watchlist.movie.added', entityId: 3 }),
      );
    });
  });

  describe('createMany', () => {
    it('writes one row per recipient and skips the actor', async () => {
      mockPrisma.notifications.create.mockResolvedValue({ id: 1, createdAt: NOW });

      await service.createMany([1, 2, 3], { type: 'watchlist_deleted', exceptUserId: 2 });

      expect(mockPrisma.notifications.create).toHaveBeenCalledTimes(2);
      const recipients = mockPrisma.notifications.create.mock.calls.map(
        ([arg]: [{ data: { userId: number } }]) => arg.data.userId,
      );
      expect(recipients).toEqual([1, 3]);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      mockPrisma.notifications.count.mockResolvedValue(3);
    });

    it('serialises rows and reports no further page when the page is short', async () => {
      mockPrisma.notifications.findMany.mockResolvedValue([row({ id: 5 })]);

      const response = await service.list(10, { limit: 20, unreadOnly: false });

      expect(response.data).toEqual({
        notifications: [
          {
            id: 5,
            type: 'friend.request.created',
            actorId: 7,
            entityId: null,
            params: { actorUsername: 'alice' },
            readAt: null,
            createdAt: NOW.toISOString(),
          },
        ],
        nextCursor: null,
        unreadCount: 3,
      });
    });

    it('hands back the last row as the next cursor on a full page', async () => {
      mockPrisma.notifications.findMany.mockResolvedValue([
        row({ id: 5 }),
        row({ id: 4, createdAt: new Date(NOW.getTime() - 1) }),
      ]);

      const response = await service.list(10, { limit: 2, unreadOnly: false });

      expect(response.data!.nextCursor).toBe(`${NOW.getTime() - 1}_4`);
    });

    it('turns a cursor into a tuple comparison scoped to the user', async () => {
      mockPrisma.notifications.findMany.mockResolvedValue([]);

      await service.list(10, { limit: 20, unreadOnly: false, cursor: '1730000000000_41' });

      expect(mockPrisma.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 10,
            OR: [{ createdAt: { lt: NOW } }, { createdAt: NOW, id: { lt: 41 } }],
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
        }),
      );
    });

    it('filters to unread rows when asked', async () => {
      mockPrisma.notifications.findMany.mockResolvedValue([]);

      await service.list(10, { limit: 20, unreadOnly: true });

      expect(mockPrisma.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 10, readAt: null } }),
      );
    });

    it('rejects a malformed cursor with 400 rather than reaching the database', async () => {
      await expect(
        service.list(10, { limit: 20, unreadOnly: false, cursor: 'nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.notifications.findMany).not.toHaveBeenCalled();
    });

    it('renders a non-object params column as an empty map', async () => {
      mockPrisma.notifications.findMany.mockResolvedValue([row({ params: ['nope'] })]);

      const response = await service.list(10, { limit: 20, unreadOnly: false });

      expect(response.data!.notifications[0].params).toEqual({});
    });
  });

  describe('markRead', () => {
    it('scopes the update to the owner and returns the refreshed count', async () => {
      mockPrisma.notifications.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notifications.count.mockResolvedValue(2);

      const response = await service.markRead(10, 5);

      expect(mockPrisma.notifications.updateMany).toHaveBeenCalledWith({
        where: { id: 5, userId: 10, readAt: null },
        data: { readAt: expect.any(Date) as Date },
      });
      expect(response.data).toEqual({ unreadCount: 2 });
    });

    it('is a no-op for a row that was already read', async () => {
      mockPrisma.notifications.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.notifications.findFirst.mockResolvedValue({ id: 5 });
      mockPrisma.notifications.count.mockResolvedValue(0);

      await expect(service.markRead(10, 5)).resolves.toBeDefined();
    });

    it("404s on another user's notification", async () => {
      mockPrisma.notifications.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.notifications.findFirst.mockResolvedValue(null);

      await expect(service.markRead(10, 5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes only rows owned by the caller', async () => {
      mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.notifications.count.mockResolvedValue(1);

      await service.remove(10, 5);

      expect(mockPrisma.notifications.deleteMany).toHaveBeenCalledWith({
        where: { id: 5, userId: 10 },
      });
    });

    it("404s rather than silently succeeding on another user's notification", async () => {
      mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(10, 5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pruneExpired', () => {
    it('drops read rows past the read window and anything past the hard window', async () => {
      mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 4 });
      const now = NOW.getTime();

      const count = await service.pruneExpired(now);

      expect(count).toBe(4);
      expect(mockPrisma.notifications.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { readAt: { not: null, lt: daysAgo(READ_RETENTION_DAYS, now) } },
            { createdAt: { lt: daysAgo(MAX_RETENTION_DAYS, now) } },
          ],
        },
      });
    });

    it('keeps an unread row that is inside the hard window but past the read window', async () => {
      mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 0 });
      const now = NOW.getTime();

      await service.pruneExpired(now);

      const [[{ where }]] = mockPrisma.notifications.deleteMany.mock.calls as [
        [{ where: { OR: [{ readAt: { lt: Date } }, { createdAt: { lt: Date } }] } }],
      ];
      const fortyDaysAgo = daysAgo(40, now).getTime();
      // A 40-day-old row is past the read cutoff, so it goes only if it was read;
      // it is still inside the hard cutoff, so unread it stays.
      expect(where.OR[0].readAt.lt.getTime()).toBeGreaterThan(fortyDaysAgo);
      expect(where.OR[1].createdAt.lt.getTime()).toBeLessThan(fortyDaysAgo);
    });
  });
});
