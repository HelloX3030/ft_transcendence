import { Friend } from 'src/types';
export interface ApiMsgResponse {
  message: string;
}

export interface FriendsResponse {
  friends: Friend[];
}

export interface UserMeResponse {
  id: number;
  username: string;
  email: string;
  image: string | null;
  role: string;
}
