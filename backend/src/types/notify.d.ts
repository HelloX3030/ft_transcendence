import { DefaultEventsMap, Socket } from 'socket.io';

export interface SocketData {
  user: number;
}

export type NotifySocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
