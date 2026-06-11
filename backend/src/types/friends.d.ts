import { friend_status } from '@prisma/client';

export type FriendKey = Prisma.FriendsUserAIdUserBIdCompoundUniqueInput;

export interface Friend {
  friendId: number;
  status: friend_status;
  createdAt: Date;
}
