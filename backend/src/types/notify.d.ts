import { Socket } from 'socket.io';

interface SocketData {
  user: number;
}

type NotifySocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
