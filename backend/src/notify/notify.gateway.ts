import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import * as cookie from 'cookie';
import { JwtService } from '@nestjs/jwt';
import type { JwtAccessPayload, NotifySocket as Socket } from 'src/types';
import { NotifyService } from './notify.service';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { FriendsStatus, NotifyMsg } from '@trailertinder/shared';
import { ChatMsgDto } from './dto';
import { FriendUtils } from 'src/utils';

@WebSocketGateway({
  namespace: 'notify',
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
})
export class NotifyGateway {
  private readonly logger = new Logger(NotifyGateway.name);

  constructor(
    @Inject(forwardRef(() => NotifyService))
    private readonly notifyService: NotifyService,
    private readonly jwtService: JwtService,
    private readonly friendUtils: FriendUtils,
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

      client.data.user = payload.sub;
      client.join(`user:${payload.sub}`);
      this.notifyService.setUserAsActive(payload.sub, client);
      this.server.emit(`online-status:${payload.sub}`, { id: payload.sub, isOnline: true });
    } catch (error) {
      this.logger.error(error);
      this.server.emit('error', 'No token provided or the token is invalid.');
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
      this.server.emit('error', 'Unable to load your friends online status.');
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

    // todo: check whots happend if a client trys to add the same chat multipli times.
    // todo: avoid that socket io is buffering the messages that can not be delivert.
    try {
      await this.notifyService.hasChatRequirements(meUserId, peerUserId);

      this.server
        .to(`user:${peerUserId}`)
        .emit('chat', { peerUserId: meUserId, time: Date.now(), msg: data.msg });
      // send evt. ack
    } catch (error) {
      // todo: error handling
      console.log(error);
    }
  }

  // @SubscribeMessage('new-chat')
  // async createChat(@MessageBody() data: ChatRequestDto, @ConnectedSocket() client: Socket) {
  //   const meUserId = client.data.user;
  //   const peerUserId = data.userId;

  //   // todo: check whots happend if a client trys to add the same chat multipli times.
  //   // todo: avoid that socket io is buffering the messages that can not be delivert.
  //   try {
  //     await this.notifyService.hasChatRequirements(meUserId, peerUserId);
  //     const socketsA = this.notifyService.getUserSockets(meUserId);
  //     const socketsB = this.notifyService.getUserSockets(peerUserId);
  //     const roomId = 1; // todo: generate a room id based on the friendId
  //     const chatRoom = `chat:${roomId}`;

  //     for (const clientSocket of [...socketsA, ...socketsB]) {
  //       clientSocket.join(chatRoom);
  //     }
  //     console.log('add client to room: ' + chatRoom);

  //     this.server
  //       .to(`user:${meUserId}`)
  //       .emit('chat', { status: true, chatPartnerId: peerUserId, chatRoom });
  //     this.server.emit('chat', { status: true, chatPartnerId: meUserId, chatRoom });

  //     this.server.emit('chat:1', 'hallo from server');
  //   } catch (error) {
  //     // todo: error handling
  //     console.log(error);
  //   }
  // }

  // @SubscribeMessage('chat:1')
  // test(@MessageBody() data: string) {
  //   console.log(data);
  //   this.server.emit('chat:1', data);
  // }

  removeChat() {}
}
