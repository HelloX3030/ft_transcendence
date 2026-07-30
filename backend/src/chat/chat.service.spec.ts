import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { messages, Prisma } from '@prisma/client';
import { NotifyService } from 'src/notify/notify.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { daysAgo, MESSAGE_RETENTION_DAYS } from 'src/retention.config';
import { FriendUtils } from 'src/utils';
import { ChatService, isMissingParticipant } from './chat.service';

const mockPrisma = {
  messages: {
    create: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockNotifyService = {
  sendChatRead: jest.fn(),
} satisfies Partial<jest.Mocked<NotifyService>>;

const NOW = new Date(1_730_000_000_000);

function row(overrides: Partial<messages> = {}): messages {
  return {
    id: 1,
    userAId: 1,
    userBId: 2,
    senderId: 1,
    body: 'hello',
    readAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        FriendUtils,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotifyService, useValue: mockNotifyService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  describe('send', () => {
    beforeEach(() => {
      mockPrisma.messages.create.mockResolvedValue(row());
    });

    function friendship(status: 'accepted' | 'pending' | null) {
      // areFriends reads through the real FriendUtils, so stub at the Prisma edge.
      (mockPrisma as unknown as { friends: unknown }).friends = {
        findUnique: jest.fn().mockResolvedValue(status === null ? null : { status }),
      };
    }

    it('stores the pair in canonical order regardless of who sends', async () => {
      friendship('accepted');

      await service.send(2, { peerUserId: 1, msg: 'hello', clientMsgId: 'c-1' });

      expect(mockPrisma.messages.create).toHaveBeenCalledWith({
        data: { userAId: 1, userBId: 2, senderId: 2, body: 'hello' },
      });
    });

    it('echoes the clientMsgId back on the persisted message', async () => {
      friendship('accepted');

      const message = await service.send(1, { peerUserId: 2, msg: 'hello', clientMsgId: 'c-1' });

      expect(message).toEqual({
        id: 1,
        peerUserId: 2,
        senderUserId: 1,
        body: 'hello',
        readAt: null,
        createdAt: NOW.toISOString(),
        clientMsgId: 'c-1',
      });
    });

    it('rejects a send to yourself explicitly, before any friendship lookup', async () => {
      friendship('accepted');

      await expect(
        service.send(1, { peerUserId: 1, msg: 'hi', clientMsgId: 'c-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.messages.create).not.toHaveBeenCalled();
    });

    it('rejects when the two users were never friends', async () => {
      friendship(null);

      await expect(
        service.send(1, { peerUserId: 2, msg: 'hi', clientMsgId: 'c-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.messages.create).not.toHaveBeenCalled();
    });

    it('rejects while the friendship is still pending', async () => {
      // Sending a request must not grant the ability to message before it is
      // accepted — otherwise strangers can DM anyone they add.
      friendship('pending');

      await expect(
        service.send(1, { peerUserId: 2, msg: 'hi', clientMsgId: 'c-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.messages.create).not.toHaveBeenCalled();
    });

    it('re-authorises on every message rather than trusting an open window', async () => {
      friendship('accepted');

      await service.send(1, { peerUserId: 2, msg: 'one', clientMsgId: 'c-1' });
      await service.send(1, { peerUserId: 2, msg: 'two', clientMsgId: 'c-2' });

      const friends = (mockPrisma as unknown as { friends: { findUnique: jest.Mock } }).friends;
      expect(friends.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMessages', () => {
    it('serves a descending fetch in ascending order', async () => {
      mockPrisma.messages.findMany.mockResolvedValue([
        row({ id: 3, createdAt: new Date(NOW.getTime() + 2) }),
        row({ id: 2, createdAt: new Date(NOW.getTime() + 1) }),
        row({ id: 1 }),
      ]);

      const response = await service.getMessages(1, 2, { limit: 30 });

      expect(response.data!.messages.map(({ id }) => id)).toEqual([1, 2, 3]);
      expect(response.data!.nextCursor).toBeNull();
    });

    it('hands back the oldest row of a full page as the cursor', async () => {
      mockPrisma.messages.findMany.mockResolvedValue([
        row({ id: 3, createdAt: new Date(NOW.getTime() + 1) }),
        row({ id: 2 }),
      ]);

      const response = await service.getMessages(1, 2, { limit: 2 });

      expect(response.data!.nextCursor).toBe(`${NOW.getTime()}_2`);
    });

    it('scopes the query to the canonical pair and walks back from the cursor', async () => {
      mockPrisma.messages.findMany.mockResolvedValue([]);

      await service.getMessages(2, 1, { limit: 30, before: '1730000000000_5' });

      expect(mockPrisma.messages.findMany).toHaveBeenCalledWith({
        where: {
          userAId: 1,
          userBId: 2,
          OR: [{ createdAt: { lt: NOW } }, { createdAt: NOW, id: { lt: 5 } }],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 30,
      });
    });

    it('rejects a malformed cursor with 400', async () => {
      await expect(service.getMessages(1, 2, { limit: 30, before: 'nope' })).rejects.toThrow();
      expect(mockPrisma.messages.findMany).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('marks only what the peer sent, and tells them about it', async () => {
      mockPrisma.messages.updateMany.mockResolvedValue({ count: 3 });

      const response = await service.markRead(1, 2);

      expect(mockPrisma.messages.updateMany).toHaveBeenCalledWith({
        where: { userAId: 1, userBId: 2, senderId: 2, readAt: null },
        data: { readAt: expect.any(Date) as Date },
      });
      expect(mockNotifyService.sendChatRead).toHaveBeenCalledWith(2, {
        peerUserId: 1,
        readAt: response.data!.readAt,
      });
    });

    it('stays quiet when there was nothing to mark', async () => {
      mockPrisma.messages.updateMany.mockResolvedValue({ count: 0 });

      await service.markRead(1, 2);

      expect(mockNotifyService.sendChatRead).not.toHaveBeenCalled();
    });
  });

  describe('pruneExpired', () => {
    it('deletes messages past the retention window', async () => {
      mockPrisma.messages.deleteMany.mockResolvedValue({ count: 5 });
      const now = NOW.getTime();

      const count = await service.pruneExpired(now);

      expect(count).toBe(5);
      expect(mockPrisma.messages.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: daysAgo(MESSAGE_RETENTION_DAYS, now) } },
      });
    });
  });
});

describe('isMissingParticipant', () => {
  it('recognises a foreign key violation', () => {
    const error = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: 'test',
    });

    expect(isMissingParticipant(error)).toBe(true);
  });

  it('does not swallow unrelated failures', () => {
    expect(isMissingParticipant(new Error('connection reset'))).toBe(false);
    expect(
      isMissingParticipant(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      ),
    ).toBe(false);
  });
});
