import { DefaultEventsMap, Socket } from 'socket.io';

export interface SocketData {
  user: number;
  /**
   * When the access token this socket handshook with expires, in epoch ms.
   * The handshake is the only point the token is checked, so the gateway
   * sweeps for sockets that have outlived it.
   */
  tokenExpiresAt?: number;
}

export type NotifySocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
