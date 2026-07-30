import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import type { DomainEvent } from '@trailertinder/shared';
import type { Namespace } from 'socket.io';
import type { NotifySocket } from 'src/types';
import { FriendUtils, SYSTEM_SENDER_ID, UserUtils } from 'src/utils';
import { ChatRequirementsException } from './exceptions/chat-requirements-exception';
import { NotifyGateway } from './notify.gateway';
import { NotifyService } from './notify.service';

const mockNotifyService = {
  setUserAsActive: jest.fn(),
  setUserAsInactive: jest.fn(),
  isOnline: jest.fn(),
  hasChatRequirements: jest.fn(),
} satisfies Partial<jest.Mocked<NotifyService>>;

const mockJwtService = {
  verifyAsync: jest.fn(),
} satisfies Partial<jest.Mocked<JwtService>>;

const mockFriendUtils = {
  getFriends: jest.fn(),
} satisfies Partial<jest.Mocked<FriendUtils>>;

const mockUserUtils = {
  getUser: jest.fn(),
} satisfies Partial<jest.Mocked<UserUtils>>;

/** One `server.to(room).emit(event, payload)` call, flattened for assertions. */
interface RoomEmit {
  room: string;
  event: string;
  payload: unknown;
}

/**
 * Stands in for the injected namespace. `to(...).emit(...)` is recorded with its
 * room so tests can assert *who* a message reached, not just that it was sent.
 */
function createMockServer() {
  const roomEmits: RoomEmit[] = [];
  const server = {
    emit: jest.fn(),
    to: jest.fn((room: string) => ({
      emit: (event: string, payload: unknown) => {
        roomEmits.push({ room, event, payload });
        return true;
      },
    })),
  };
  return { server, roomEmits };
}

function createMockSocket(userId?: number, cookie = 'access_token=valid-token') {
  return {
    data: { user: userId } as { user: number; tokenExpiresAt?: number },
    handshake: { headers: { cookie } },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

type MockSocket = ReturnType<typeof createMockSocket>;

const asSocket = (socket: MockSocket) => socket as unknown as NotifySocket;

/** `server` is private and normally populated by Nest's WS bootstrap. */
function attachServer(gateway: NotifyGateway, server: unknown) {
  (gateway as unknown as { server: Namespace }).server = server as Namespace;
}

describe('NotifyGateway', () => {
  let gateway: NotifyGateway;
  let server: ReturnType<typeof createMockServer>['server'];
  let roomEmits: RoomEmit[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyGateway,
        { provide: NotifyService, useValue: mockNotifyService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: FriendUtils, useValue: mockFriendUtils },
        { provide: UserUtils, useValue: mockUserUtils },
      ],
    }).compile();

    gateway = module.get<NotifyGateway>(NotifyGateway);
    jest.clearAllMocks();

    ({ server, roomEmits } = createMockServer());
    attachServer(gateway, server);

    // The gateway logs every rejected connection; keep the suite output clean.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('records the token expiry so the sweep can act on it', async () => {
      const client = createMockSocket();
      const exp = Math.floor(Date.now() / 1000) + 900;
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 7, email: 'a@example.com', exp });
      mockUserUtils.getUser.mockResolvedValue({ username: 'ada' });
      mockFriendUtils.getFriends.mockResolvedValue([]);

      await gateway.handleConnection(asSocket(client));

      expect(client.data.tokenExpiresAt).toBe(exp * 1000);
    });

    it('joins the user room and broadcasts online for a valid token', async () => {
      const client = createMockSocket();
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 7, email: 'a@example.com' });
      mockUserUtils.getUser.mockResolvedValue({ username: 'ada' });
      mockFriendUtils.getFriends.mockResolvedValue([]);

      await gateway.handleConnection(asSocket(client));

      expect(client.data.user).toBe(7);
      expect(client.join).toHaveBeenCalledWith('user:7');
      expect(mockNotifyService.setUserAsActive).toHaveBeenCalledWith(7, client);
      expect(roomEmits).toContainEqual({
        room: 'online-status:7',
        event: 'online-status:7',
        payload: { id: 7, isOnline: true },
      });
      expect(server.emit).not.toHaveBeenCalled();
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('seeds friend presence rooms from the DB on (re)connect', async () => {
      const client = createMockSocket();
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 7, email: 'a@example.com' });
      mockUserUtils.getUser.mockResolvedValue({ username: 'ada' });
      mockFriendUtils.getFriends.mockResolvedValue([2, 3]);
      mockNotifyService.isOnline.mockImplementation((id: number) => id === 2);

      await gateway.handleConnection(asSocket(client));

      expect(mockFriendUtils.getFriends).toHaveBeenCalledWith(7);
      expect(client.join).toHaveBeenCalledWith('online-status:2');
      expect(client.join).toHaveBeenCalledWith('online-status:3');
      expect(client.emit).toHaveBeenCalledWith('watch-friends-status', [
        { id: 2, isOnline: true },
        { id: 3, isOnline: false },
      ]);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('keeps the connection alive when presence seeding fails', async () => {
      const client = createMockSocket();
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 7, email: 'a@example.com' });
      mockUserUtils.getUser.mockResolvedValue({ username: 'ada' });
      mockFriendUtils.getFriends.mockRejectedValue(new Error('db down'));

      await gateway.handleConnection(asSocket(client));

      expect(mockNotifyService.setUserAsActive).toHaveBeenCalledWith(7, client);
      expect(roomEmits).toContainEqual({
        room: 'online-status:7',
        event: 'online-status:7',
        payload: { id: 7, isOnline: true },
      });
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('rejects a handshake without a token', async () => {
      const client = createMockSocket(undefined, '');

      await gateway.handleConnection(asSocket(client));

      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
      expect(mockNotifyService.setUserAsActive).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith('error', expect.any(String));
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects a handshake with an invalid token', async () => {
      const client = createMockSocket();
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await gateway.handleConnection(asSocket(client));

      expect(mockNotifyService.setUserAsActive).not.toHaveBeenCalled();
      expect(roomEmits).toHaveLength(0);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects a valid token whose account no longer exists', async () => {
      const client = createMockSocket();
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 7, email: 'ghost@example.com' });
      mockUserUtils.getUser.mockRejectedValue(new Error('User not found.'));

      await gateway.handleConnection(asSocket(client));

      expect(mockUserUtils.getUser).toHaveBeenCalledWith(7);
      expect(mockNotifyService.setUserAsActive).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
      expect(roomEmits).toHaveLength(0);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('disconnectExpiredSockets', () => {
    /** Stands in for namespace.sockets, which the sweep iterates. */
    function attachSockets(...sockets: MockSocket[]) {
      (server as unknown as { sockets: Map<string, unknown> }).sockets = new Map(
        sockets.map((socket, i) => [String(i), socket]),
      );
    }

    it('drops a socket whose token has already expired', () => {
      const expired = createMockSocket(7);
      expired.data.tokenExpiresAt = Date.now() - 1_000;
      attachSockets(expired);

      gateway.disconnectExpiredSockets();

      expect(expired.emit).toHaveBeenCalledWith('error', expect.any(String));
      expect(expired.disconnect).toHaveBeenCalledWith(true);
    });

    it('leaves a socket whose token is still valid alone', () => {
      const live = createMockSocket(7);
      live.data.tokenExpiresAt = Date.now() + 60_000;
      attachSockets(live);

      gateway.disconnectExpiredSockets();

      expect(live.disconnect).not.toHaveBeenCalled();
    });

    it('drops only the expired sockets', () => {
      const expired = createMockSocket(1);
      expired.data.tokenExpiresAt = Date.now() - 1;
      const live = createMockSocket(2);
      live.data.tokenExpiresAt = Date.now() + 60_000;
      attachSockets(expired, live);

      gateway.disconnectExpiredSockets();

      expect(expired.disconnect).toHaveBeenCalledWith(true);
      expect(live.disconnect).not.toHaveBeenCalled();
    });

    it('leaves a socket with no recorded expiry alone', () => {
      const socket = createMockSocket(7);
      attachSockets(socket);

      gateway.disconnectExpiredSockets();

      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('does nothing before the namespace is attached', () => {
      attachServer(gateway, undefined);

      expect(() => gateway.disconnectExpiredSockets()).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('clears presence and announces offline when the last socket goes', () => {
      const client = createMockSocket(7);
      mockNotifyService.isOnline.mockReturnValue(false);

      gateway.handleDisconnect(asSocket(client));

      expect(mockNotifyService.setUserAsInactive).toHaveBeenCalledWith(7, client);
      expect(roomEmits).toContainEqual({
        room: 'online-status:7',
        event: 'online-status:7',
        payload: { id: 7, isOnline: false },
      });
      expect(server.emit).not.toHaveBeenCalled();
    });

    it('stays silent while the user still has another socket open', () => {
      const client = createMockSocket(7);
      mockNotifyService.isOnline.mockReturnValue(true);

      gateway.handleDisconnect(asSocket(client));

      expect(mockNotifyService.setUserAsInactive).toHaveBeenCalledWith(7, client);
      expect(roomEmits).toHaveLength(0);
    });

    it('ignores a socket that never authenticated', () => {
      const client = createMockSocket(undefined);

      gateway.handleDisconnect(asSocket(client));

      expect(mockNotifyService.setUserAsInactive).not.toHaveBeenCalled();
      expect(roomEmits).toHaveLength(0);
    });
  });

  describe('userStatus', () => {
    it('sends one batched array to the subscribing socket only', async () => {
      const client = createMockSocket(1);
      mockFriendUtils.getFriends.mockResolvedValue([2, 3, 4]);
      mockNotifyService.isOnline.mockImplementation((id: number) => id === 3);

      await gateway.userStatus(asSocket(client));

      expect(client.emit).toHaveBeenCalledTimes(1);
      expect(client.emit).toHaveBeenCalledWith('watch-friends-status', [
        { id: 2, isOnline: false },
        { id: 3, isOnline: true },
        { id: 4, isOnline: false },
      ]);
      // The seed must not fan out to the user's other tabs.
      expect(roomEmits).toHaveLength(0);
    });

    it('joins a presence room for every friend', async () => {
      const client = createMockSocket(1);
      mockFriendUtils.getFriends.mockResolvedValue([2, 3]);
      mockNotifyService.isOnline.mockReturnValue(false);

      await gateway.userStatus(asSocket(client));

      expect(client.join).toHaveBeenCalledWith('online-status:2');
      expect(client.join).toHaveBeenCalledWith('online-status:3');
    });

    it('emits an error when the friend lookup fails', async () => {
      const client = createMockSocket(1);
      mockFriendUtils.getFriends.mockRejectedValue(new Error('db down'));

      await gateway.userStatus(asSocket(client));

      expect(client.emit).toHaveBeenCalledWith('error', expect.any(String));
    });
  });

  describe('addClientToStatusUpdate', () => {
    it('joins the presence room and seeds only the given socket', () => {
      const client = createMockSocket(1);
      mockNotifyService.isOnline.mockReturnValue(true);

      gateway.addClientToStatusUpdate(asSocket(client), 9);

      expect(client.join).toHaveBeenCalledWith('online-status:9');
      expect(client.emit).toHaveBeenCalledWith('watch-friends-status', [{ id: 9, isOnline: true }]);
      expect(roomEmits).toHaveLength(0);
    });
  });

  describe('rmClientFromStatusUpdate', () => {
    it('leaves the presence room and notifies only the given socket', () => {
      const client = createMockSocket(1);

      gateway.rmClientFromStatusUpdate(asSocket(client), 9);

      expect(client.leave).toHaveBeenCalledWith('online-status:9');
      expect(client.emit).toHaveBeenCalledWith('watch-friends-status-rm', [
        { id: 9, isOnline: false },
      ]);
      expect(roomEmits).toHaveLength(0);
    });
  });

  describe('sendDomainEvent', () => {
    it('targets the recipient user room on the single event channel', () => {
      const event: DomainEvent = {
        type: 'friend.request.created',
        actorId: 1,
        entityId: null,
        params: { actorUsername: 'alice' },
        notificationId: 42,
        at: 1_730_000_000_000,
      };

      gateway.sendDomainEvent(5, event);

      expect(roomEmits).toEqual([{ room: 'user:5', event: 'event', payload: event }]);
    });
  });

  describe('chat', () => {
    const dto = { peerUserId: 2, msg: 'hello' };

    it('relays to the peer and echoes to every tab of the sender', async () => {
      const client = createMockSocket(1);
      mockNotifyService.hasChatRequirements.mockResolvedValue(undefined);

      await gateway.chat(dto, asSocket(client));

      expect(roomEmits).toHaveLength(2);
      expect(roomEmits[0]).toMatchObject({
        room: 'user:2',
        event: 'chat',
        payload: { peerUserId: 1, senderUserId: 1, msg: 'hello' },
      });
      expect(roomEmits[1]).toMatchObject({
        room: 'user:1',
        event: 'chat',
        payload: { peerUserId: 2, senderUserId: 1, msg: 'hello' },
      });
    });

    it('stamps the peer relay and the sender echo with the same time', async () => {
      const client = createMockSocket(1);
      mockNotifyService.hasChatRequirements.mockResolvedValue(undefined);
      // Back-to-back Date.now() calls almost always land in the same millisecond,
      // so a real clock would pass even if each emit stamped itself. Handing out a
      // new value per call makes "read the clock once" the only way through.
      let clock = 1_000;
      const now = jest.spyOn(Date, 'now').mockImplementation(() => (clock += 1));

      await gateway.chat(dto, asSocket(client));

      expect(now).toHaveBeenCalledTimes(1);
      const times = roomEmits.map((emit) => (emit.payload as { time: number }).time);
      expect(times).toEqual([1_001, 1_001]);

      now.mockRestore();
    });

    it('sends only a system error when the requirements are not met', async () => {
      const client = createMockSocket(1);
      mockNotifyService.hasChatRequirements.mockRejectedValue(
        new ChatRequirementsException('The user is offline.'),
      );

      await gateway.chat(dto, asSocket(client));

      expect(roomEmits).toEqual([
        {
          room: 'user:1',
          event: 'chat',
          payload: {
            peerUserId: 2,
            senderUserId: SYSTEM_SENDER_ID,
            time: expect.any(Number) as number,
            msg: 'The user is offline.',
          },
        },
      ]);
    });

    it('never echoes an undelivered message body', async () => {
      const client = createMockSocket(1);
      mockNotifyService.hasChatRequirements.mockRejectedValue(
        new ChatRequirementsException('You are not friends with this user.'),
      );

      await gateway.chat(dto, asSocket(client));

      const bodies = roomEmits.map((emit) => (emit.payload as { msg: string }).msg);
      expect(bodies).not.toContain('hello');
    });

    it('hides unexpected failures behind a generic message', async () => {
      const client = createMockSocket(1);
      mockNotifyService.hasChatRequirements.mockRejectedValue(new Error('connection reset'));

      await gateway.chat(dto, asSocket(client));

      expect(roomEmits).toHaveLength(1);
      const payload = roomEmits[0].payload as { msg: string; senderUserId: number };
      expect(payload.senderUserId).toBe(SYSTEM_SENDER_ID);
      expect(payload.msg).not.toContain('connection reset');
    });
  });
});
