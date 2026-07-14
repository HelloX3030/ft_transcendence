export interface NotifyMsg {
  titel: string;
  msg: string;
}

export interface FriendsStatus {
  id: number;
  isOnline: boolean;
}

export interface ChatRequest {
  userId: number;
}
