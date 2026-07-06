import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as cookie from 'cookie';
import { JwtService } from '@nestjs/jwt';
import { JwtAccessPayload } from 'src/types';
import { NotifyService } from './notify.service';
import { forwardRef, Inject } from '@nestjs/common';

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
      console.log(error);
      this.server.emit('error', 'No token provided or the token is invalid.');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Disconnected:', client.id, ' userid: ' + client.data.user);
    this.notifyService.setUserAsInative(client.data.user, client);
    this.server.emit(`online-status:${client.data.user}`, {
      id: client.data.user,
      isOnline: false,
    });
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() message: string, @ConnectedSocket() client: Socket): void {
    this.server.emit<'message'>('message', message);
  }

  @SubscribeMessage('watch-friends-status')
  async userStatus(@MessageBody() msg: string, @ConnectedSocket() client: Socket) {
    if (msg === 'init') {
      const friendIds = await this.notifyService.getFreinds(client.data.user);
      const friendsStatus: { id: number; isOnline: boolean }[] = [];
      for (const userId of friendIds) {
        friendsStatus.push({ id: userId, isOnline: this.notifyService.isOnline(userId) });
        this.addClientToStatusUpdate(client, userId);
      }
      this.server.to(`user:${client.data.user}`).emit('watch-friends-status', friendsStatus);
    }
  }

  addClientToStatusUpdate(client: Socket, userId: number) {
    client.join(`online-status:${userId}`);
    console.log(`Add user to online-status:${userId}`);
  }

  rmClientFromStatusUpdate(client: Socket, userId: number) {
    client.leave(`online-status:${userId}`);
    console.log(`Removed user from online-status:${userId}`);
  }

  sendMessage(message: string, userId: number) {
    console.log(message);

    this.server.to(`user:${userId}`).emit('message', message);

    // this.server.emit('message', message);
  }
}
