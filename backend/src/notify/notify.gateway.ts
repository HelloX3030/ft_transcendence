import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
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

@WebSocketGateway({
  namespace: 'notify',
  cors: {
    origin: 'http://localhost:5173', // todo: env with the url
    credentials: true,
  },
})
export class NotifyGateway {
  constructor(private readonly jwtService: JwtService) {}
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
    } catch (error) {
      console.log(error);
      this.server.emit('error', 'No token provided or the token is invalid.');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log('Disconnected:', client.id, ' userid: ' + client.data.user);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() message: string, @ConnectedSocket() client: Socket): void {
    console.log(client);
    this.server.emit<'message'>('message', message);
  }

  sendMessage(message: string, userId: number) {
    console.log(message);

    this.server.to(`user:${userId}`).emit('message', message);

    // this.server.emit('message', message);
  }
}
