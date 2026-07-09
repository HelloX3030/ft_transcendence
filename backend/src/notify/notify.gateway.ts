import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as cookie from 'cookie';
import { JwtService } from '@nestjs/jwt';
import { JwtAccessPayload } from 'src/types';
import { NotifyService } from './notify.service';
import { forwardRef, Inject, UseFilters } from '@nestjs/common';
import { FriendsStatus, NotifyMsg } from '@trailertinder/shared';

@WebSocketGateway({
  namespace: 'notify',
  cors: {
    origin: 'http://localhost:5173', // todo: env with the url
    credentials: true,
  },
})
export class NotifyGateway {
  constructor(
    @Inject(forwardRef(() => NotifyService))
    private readonly notifyService: NotifyService,
    private readonly jwtService: JwtService,
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
      console.log(payload);
      client.join(`user:${payload.sub}`);
      this.notifyService.setUserAsActive(payload.sub, client);
      this.server.emit(`online-status:${payload.sub}`, { id: payload.sub, isOnline: true });
    } catch (error) {
      console.error(error);
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
  async userStatus(@MessageBody() msg: string, @ConnectedSocket() client: Socket) {
    if (msg === 'init') {
      const friendIds = await this.notifyService.getFreinds(client.data.user);
      for (const userId of friendIds) {
        this.addClientToStatusUpdate(client, userId);
      }
    }
  }

  addClientToStatusUpdate(client: Socket, userId: number) {
    const friendsStatus: FriendsStatus[] = [];
    friendsStatus.push({ id: userId, isOnline: this.notifyService.isOnline(userId) });
    client.join(`online-status:${userId}`);
    this.server.to(`user:${client.data.user}`).emit('watch-friends-status', friendsStatus);
    console.log(`Add user to online-status:${userId}`);
  }

  rmClientFromStatusUpdate(client: Socket, userId: number) {
    client.leave(`online-status:${userId}`);
    const friendsStatus: FriendsStatus[] = [];
    friendsStatus.push({ id: userId, isOnline: false });
    this.server.to(`user:${client.data.user}`).emit('watch-friends-status-rm', friendsStatus);
    console.log(`Removed user from online-status:${userId}`);
  }

  // -------------------------
  // Send Notifications
  // -------------------------
  sendMessage(userId: number, message: NotifyMsg) {
    console.log(message);
    throw new WsException('Test error');
    this.server.to(`user:${userId}`).emit('message', message);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() message: string, @ConnectedSocket() client: Socket): void {
    this.server.emit<'message'>('message', message);
  }
}
