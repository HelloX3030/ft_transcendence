import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import * as cookie from 'cookie';
import { JwtService } from '@nestjs/jwt';
import type { JwtAccessPayload, NotifySocket as Socket } from 'src/types';
import { NotifyService } from './notify.service';
import { forwardRef, Inject, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { FriendsStatus, NotifyMsg } from '@trailertinder/shared';
import { ChatMsgDto } from './dto';
import { FriendUtils, SYSTEM_SENDER_ID, UserUtils } from 'src/utils';
import { ChatRequiremtnsException } from './exceptions/chat-requirements-exception';

@WebSocketGateway({
  namespace: 'notify',
  cors: {
    origin: process.env.CORS_ORIGIN,
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
export class NotifyGateway implements OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket> {
  private readonly logger = new Logger(NotifyGateway.name);

  constructor(
    @Inject(forwardRef(() => NotifyService))
    private readonly notifyService: NotifyService,
    private readonly jwtService: JwtService,
    private readonly friendUtils: FriendUtils,
    private readonly userUtils: UserUtils,
  ) {}
  @WebSocketServer()
  server: Server = new Server();

  async handleConnection(client: Socket) {
    try {
      const cookies = cookie.parse(client.handshake.headers.cookie ?? '');
      const token = cookies.access_token;

      if (!token) {
        throw new Error('No token provided.');
      }
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      // A token can outlive the account it was issued for. Without this check a
      // deleted user is added to the presence map and broadcast as online.
      await this.userUtils.getUser(payload.sub);

      client.data.user = payload.sub;
      client.join(`user:${payload.sub}`);
      this.notifyService.setUserAsActive(payload.sub, client);
      this.server.emit(`online-status:${payload.sub}`, { id: payload.sub, isOnline: true });
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
    this.notifyService.setUserAsInative(userId, client);
    this.server.emit(`online-status:${userId}`, {
      id: userId,
      isOnline: false,
    });
  }

  // -------------------------
  // User online Status
  // -------------------------
  @SubscribeMessage('watch-friends-status')
  async userStatus(@ConnectedSocket() client: Socket) {
    try {
      const friendIds = await this.friendUtils.getFreinds(client.data.user);
      for (const userId of friendIds) {
        this.addClientToStatusUpdate(client, userId);
      }
    } catch (error) {
      this.logger.error(error);
      client.emit('error', 'Unable to load your friends online status.');
    }
  }

  addClientToStatusUpdate(client: Socket, userId: number) {
    const friendsStatus: FriendsStatus[] = [];
    friendsStatus.push({ id: userId, isOnline: this.notifyService.isOnline(userId) });
    client.join(`online-status:${userId}`);
    this.server.to(`user:${client.data.user}`).emit('watch-friends-status', friendsStatus);
    this.logger.debug(`Add user to online-status:${userId}`);
  }

  rmClientFromStatusUpdate(client: Socket, userId: number) {
    client.leave(`online-status:${userId}`);
    const friendsStatus: FriendsStatus[] = [];
    friendsStatus.push({ id: userId, isOnline: false });
    this.server.to(`user:${client.data.user}`).emit('watch-friends-status-rm', friendsStatus);
    this.logger.debug(`Removed user from online-status:${userId}`);
  }

  // -------------------------
  // Send Notifications
  // -------------------------
  sendNotification(userId: number, message: NotifyMsg) {
    this.server.to(`user:${userId}`).emit('notification', message);
  }

  // -------------------------
  // User Chat
  // -------------------------
  @SubscribeMessage('chat')
  async chat(@MessageBody() data: ChatMsgDto, @ConnectedSocket() client: Socket) {
    const meUserId = client.data.user;
    const peerUserId = data.peerUserId;

    try {
      await this.notifyService.hasChatRequirements(meUserId, peerUserId);

      this.server.to(`user:${peerUserId}`).emit('chat', {
        peerUserId: meUserId,
        senderUserId: meUserId,
        time: Date.now(),
        msg: data.msg,
      });
      client.to(`user:${meUserId}`).emit('chat', {
        peerUserId: peerUserId,
        senderUserId: meUserId,
        time: Date.now(),
        msg: data.msg,
      });
    } catch (error) {
      let errorMsg = 'An unknown error occurred while sending this message.';
      if (error instanceof ChatRequiremtnsException) {
        errorMsg = error.message;
      } else {
        this.logger.error(error);
      }
      client.to(`user:${meUserId}`).emit('chat', {
        peerUserId: peerUserId,
        senderUserId: meUserId,
        time: Date.now(),
        msg: data.msg,
      });
      this.server.to(`user:${meUserId}`).emit('chat', {
        peerUserId,
        senderUserId: SYSTEM_SENDER_ID,
        time: Date.now(),
        msg: errorMsg,
      });
    }
  }
}
