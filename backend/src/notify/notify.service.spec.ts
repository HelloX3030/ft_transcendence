import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NotifySocket } from 'src/types';
import { FriendUtils } from 'src/utils';
import { ChatRequiremtnsException } from './exceptions/chat-requirements-exception';
import { NotifyGateway } from './notify.gateway';
import { NotifyService } from './notify.service';

const mockNotifyGateway = {
  addClientToStatusUpdate: jest.fn(),
  rmClientFromStatusUpdate: jest.fn(),
  sendNotification: jest.fn(),
} satisfies Partial<jest.Mocked<NotifyGateway>>;

const mockFriendUtils = {
  areFriends: jest.fn(),
} satisfies Partial<jest.Mocked<FriendUtils>>;

/** Sockets are only ever used as set members here, so an empty object suffices. */
const socket = (label: string) => ({ label }) as unknown as NotifySocket;

describe('NotifyService', () => {
  let service: NotifyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyService,
        { provide: NotifyGateway, useValue: mockNotifyGateway },
        { provide: FriendUtils, useValue: mockFriendUtils },
      ],
    }).compile();

    service = module.get<NotifyService>(NotifyService);
    jest.clearAllMocks();

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('presence', () => {
    it('reports a user with no sockets as offline', () => {
      expect(service.isOnline(1)).toBe(false);
    });

    it('reports a user as online once a socket is registered', () => {
      service.setUserAsActive(1, socket('a'));

      expect(service.isOnline(1)).toBe(true);
    });

    it('keeps a user online while any tab remains connected', () => {
      const tabA = socket('a');
      const tabB = socket('b');
      service.setUserAsActive(1, tabA);
      service.setUserAsActive(1, tabB);

      service.setUserAsInative(1, tabA);

      expect(service.isOnline(1)).toBe(true);
    });

    it('marks a user offline once the last tab disconnects', () => {
      const tabA = socket('a');
      const tabB = socket('b');
      service.setUserAsActive(1, tabA);
      service.setUserAsActive(1, tabB);

      service.setUserAsInative(1, tabA);
      service.setUserAsInative(1, tabB);

      expect(service.isOnline(1)).toBe(false);
    });

    it('tracks users independently', () => {
      service.setUserAsActive(1, socket('a'));

      expect(service.isOnline(2)).toBe(false);
    });

    it('survives a disconnect for a user that was never active', () => {
      expect(() => service.setUserAsInative(99, socket('a'))).not.toThrow();
      expect(service.isOnline(99)).toBe(false);
    });
  });

  describe('addUserToOnlineStatus', () => {
    it('subscribes every tab of the monitoring user', () => {
      const tabA = socket('a');
      const tabB = socket('b');
      service.setUserAsActive(1, tabA);
      service.setUserAsActive(1, tabB);

      service.addUserToOnlineStatus(1, 2);

      expect(mockNotifyGateway.addClientToStatusUpdate).toHaveBeenCalledTimes(2);
      expect(mockNotifyGateway.addClientToStatusUpdate).toHaveBeenCalledWith(tabA, 2);
      expect(mockNotifyGateway.addClientToStatusUpdate).toHaveBeenCalledWith(tabB, 2);
    });

    it('does nothing when the monitoring user is offline', () => {
      service.addUserToOnlineStatus(1, 2);

      expect(mockNotifyGateway.addClientToStatusUpdate).not.toHaveBeenCalled();
    });
  });

  describe('rmUserFromOnlineStatus', () => {
    it('unsubscribes every tab of the monitoring user', () => {
      const tabA = socket('a');
      service.setUserAsActive(1, tabA);

      service.rmUserFromOnlineStatus(1, 2);

      expect(mockNotifyGateway.rmClientFromStatusUpdate).toHaveBeenCalledWith(tabA, 2);
    });

    it('does nothing when the monitoring user is offline', () => {
      service.rmUserFromOnlineStatus(1, 2);

      expect(mockNotifyGateway.rmClientFromStatusUpdate).not.toHaveBeenCalled();
    });
  });

  describe('sendNotify', () => {
    it('delegates to the gateway', () => {
      const message = { titel: 'Hi', msg: 'You have a friend request.' };

      service.sendNotify(5, message);

      expect(mockNotifyGateway.sendNotification).toHaveBeenCalledWith(5, message);
    });
  });

  describe('hasChatRequirements', () => {
    it('rejects when the two users are not friends', async () => {
      mockFriendUtils.areFriends.mockResolvedValue(false);
      service.setUserAsActive(2, socket('peer'));

      await expect(service.hasChatRequirements(1, 2)).rejects.toBeInstanceOf(
        ChatRequiremtnsException,
      );
    });

    it('rejects when the peer is offline', async () => {
      mockFriendUtils.areFriends.mockResolvedValue(true);

      await expect(service.hasChatRequirements(1, 2)).rejects.toThrow('The user is offline.');
    });

    it('resolves for an online friend', async () => {
      mockFriendUtils.areFriends.mockResolvedValue(true);
      service.setUserAsActive(2, socket('peer'));

      await expect(service.hasChatRequirements(1, 2)).resolves.toBeUndefined();
    });

    it('checks friendship before presence', async () => {
      mockFriendUtils.areFriends.mockResolvedValue(false);

      await expect(service.hasChatRequirements(1, 2)).rejects.toThrow(
        'You are not friends with this user.',
      );
    });
  });
});
