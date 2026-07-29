export interface NotifyMsg {
  title: string;
  msg: string;
}

export interface FriendsStatus {
  id: number;
  isOnline: boolean;
}

export interface ChatMsgSend {
  peerUserId: number;
  msg: string;
}

export interface ChatMsgRecive {
  peerUserId: number;
  senderUserId: number;
  time: number;
  msg: string;
}

export interface NotifyError {
  message: string;
}
