import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace } from 'socket.io';
import * as cookie from 'cookie';
import { JwtService } from '@nestjs/jwt';
import type { JwtAccessPayload, NotifySocket as Socket } from 'src/types';
import { NotifyService } from './notify.service';
import {
  forwardRef,
  HttpException,
  Inject,
  Logger,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ChatAck, ChatMessage, ChatReadEvent, DomainEvent, FriendsStatus } from '@cinemates/shared';
import { ChatMsgDto } from 'src/chat/dto';
import { ChatService, isMissingParticipant } from 'src/chat/chat.service';
import { FriendUtils, UserUtils } from 'src/utils';
import { onlineStatusRoom, userRoom } from './notify.rooms';
import { APP_ORIGINS } from 'src/config/origins';
import { WsAckExceptionFilter } from 'src/filter/ws-ack-exception.filter';

/** How often to look for sockets whose access token has run out. */
const TOKEN_EXPIRY_SWEEP_MS = 60_000;

@WebSocketGateway({
  namespace: 'notify',
  cors: {
    origin: APP_ORIGINS,
    credentials: true,
  },
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
// The pipe above rejects before the handler body, where the try/catch that turns
// an error into an acknowledgement lives. Global filters do not reach a gateway,
// so this one has to be declared here or a rejected payload is answered by
// nothing at all.
@UseFilters(new WsAckExceptionFilter())
export class NotifyGateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket> {
  private readonly logger = new Logger(NotifyGateway.name);

  constructor(
    @Inject(forwardRef(() => NotifyService))
    private readonly notifyService: NotifyService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly friendUtils: FriendUtils,
    private readonly userUtils: UserUtils,
  ) {}
  // @WebSocketServer() injects the `notify` namespace, not the root Server, so
  // every emit below is already scoped to it.
  @WebSocketServer()
  private server: Namespace;

  async handleConnection(client: Socket) {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie ?? '');
      const token = cookies.access_token;

      if (!token) {
        throw new Error('No token provided.');
      }
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload & { exp?: number }>(
        token,
        { secret: process.env.JWT_ACCESS_SECRET },
      );

      // A token can outlive the account it was issued for. Without this check a
      // deleted user is added to the presence map and broadcast as online.
      await this.userUtils.getUser(payload.sub);

      client.data.user = payload.sub;
      // exp is in seconds; the sweep below compares it against Date.now().
      client.data.tokenExpiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
      client.join(userRoom(payload.sub));
      this.notifyService.setUserAsActive(payload.sub, client);
      this.publishPresence(payload.sub, true);

      // Reconcile this socket's presence rooms from the DB on every (re)connect.
      // Rooms are per-socket, so a fresh socket (initial load or a silent
      // socket.io reconnect) is in no status rooms until seeded. A failure here
      // must not tear down an otherwise-valid connection.
      try {
        await this.seedFriendStatusRooms(client);
      } catch (error) {
        this.logger.error(error);
      }
    } catch (error) {
      this.logger.error(error);
      client.emit('error', 'No token provided or the token is invalid.');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user;

    if (!userId) {
      return;
    }
    this.notifyService.setUserAsInactive(userId, client);
    // Sockets are ref-counted per user, so closing one of several open tabs
    // must not announce the user as offline while the others are still up.
    if (!this.notifyService.isOnline(userId)) {
      this.publishPresence(userId, false);
    }
  }

  /**
   * Drops sockets whose access token has run out.
   *
   * The token is only checked during the handshake, so without this a socket
   * opened with a valid token keeps its authorisation for as long as it stays
   * connected — indefinitely. Disconnecting lets the client reconnect, which
   * re-runs the handshake against whatever cookie it holds by then.
   */
  @Interval(TOKEN_EXPIRY_SWEEP_MS)
  disconnectExpiredSockets() {
    const sockets = this.server?.sockets;
    if (sockets === undefined) return;

    const now = Date.now();
    for (const socket of sockets.values() as Iterable<Socket>) {
      const expiresAt = socket.data?.tokenExpiresAt;
      if (expiresAt !== undefined && expiresAt <= now) {
        this.logger.debug(`Disconnecting socket of user ${socket.data.user}: token expired`);
        socket.emit('error', 'Your session expired.');
        socket.disconnect(true);
      }
    }
  }

  /**
   * Publishes a presence transition to the watchers of `userId` only. The room
   * and the event share a name, so the emit reaches exactly the sockets that
   * `seedFriendStatusRooms` subscribed — a plain `server.emit` would put every
   * user's presence on the wire for every connected socket.
   */
  private publishPresence(userId: number, isOnline: boolean) {
    this.server
      .to(onlineStatusRoom(userId))
      .emit(onlineStatusRoom(userId), { id: userId, isOnline });
  }

  // -------------------------
  // User online Status
  // -------------------------
  @SubscribeMessage('watch-friends-status')
  async userStatus(@ConnectedSocket() client: Socket) {
    try {
      await this.seedFriendStatusRooms(client);
    } catch (error) {
      this.logger.error(error);
      client.emit('error', 'Unable to load your friends online status.');
    }
  }

  /**
   * Joins `client` to the presence room of every accepted friend and pushes the
   * current online/offline snapshot back to that socket. Runs both on connect
   * (server-driven, covers reconnects) and on the `watch-friends-status`
   * subscribe. Callers decide how a failure surfaces to the client.
   */
  private async seedFriendStatusRooms(client: Socket) {
    const friendIds = await this.friendUtils.getFriends(client.data.user);
    const friendsStatus: FriendsStatus[] = [];

    for (const userId of friendIds) {
      client.join(onlineStatusRoom(userId));
      friendsStatus.push({ id: userId, isOnline: this.notifyService.isOnline(userId) });
    }
    // One emit with every friend, only to the tab that subscribed.
    client.emit('watch-friends-status', friendsStatus);
    this.logger.debug(`Added user to ${friendsStatus.length} online-status rooms`);
  }

  addClientToStatusUpdate(client: Socket, userId: number) {
    client.join(onlineStatusRoom(userId));
    client.emit('watch-friends-status', [
      { id: userId, isOnline: this.notifyService.isOnline(userId) },
    ]);
    this.logger.debug(`Add user to online-status:${userId}`);
  }

  rmClientFromStatusUpdate(client: Socket, userId: number) {
    client.leave(onlineStatusRoom(userId));
    client.emit('watch-friends-status-rm', [{ id: userId, isOnline: false }]);
    this.logger.debug(`Removed user from online-status:${userId}`);
  }

  // -------------------------
  // Send Notifications
  // -------------------------
  /**
   * One channel for every domain change. The client routes on `event.type`, so
   * a new feature becomes live-updating by registering a type rather than by
   * adding another socket event and another listener.
   */
  sendDomainEvent(userId: number, event: DomainEvent) {
    this.server.to(userRoom(userId)).emit('event', event);
  }

  sendChatMessage(userId: number, message: ChatMessage) {
    this.server.to(userRoom(userId)).emit('chat.message.created', message);
  }

  sendChatRead(userId: number, event: ChatReadEvent) {
    this.server.to(userRoom(userId)).emit('chat.read', event);
  }

  // -------------------------
  // User Chat
  // -------------------------
  /**
   * Persists first, then broadcasts, then acknowledges.
   *
   * The handler returns a socket.io acknowledgement rather than emitting a
   * failure into the transcript: an error is not a chat message, and the client
   * needs to be able to render it as one.
   */
  @SubscribeMessage('chat')
  async chat(@MessageBody() data: ChatMsgDto, @ConnectedSocket() client: Socket): Promise<ChatAck> {
    const meUserId = client.data.user;
    const peerUserId = data.peerUserId;

    try {
      const message = await this.chatService.send(meUserId, data);

      // `peerUserId` is "the other party", so each side gets its own view of it.
      this.sendChatMessage(peerUserId, { ...message, peerUserId: meUserId });
      // The sender's own tabs are included so every tab renders the same
      // transcript; `clientMsgId` is what keeps the optimistic copy from
      // double-rendering in the tab that sent it.
      this.sendChatMessage(meUserId, message);

      return { ok: true, message };
    } catch (error) {
      if (isMissingParticipant(error)) {
        return { ok: false, error: 'This user no longer exists.' };
      }
      if (error instanceof HttpException) {
        return { ok: false, error: error.message };
      }
      // A gateway handler must never leave an unhandled rejection: the HTTP
      // Prisma filter does not cover socket handlers.
      this.logger.error(error);
      return { ok: false, error: 'An unknown error occurred while sending this message.' };
    }
  }
}
