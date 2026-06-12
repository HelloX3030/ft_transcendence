import { friend_status, Prisma } from '@prisma/client';

export type FriendKey = Prisma.friendsUserAIdUserBIdCompoundUniqueInput;

export interface Friend {
  friendId: number;
  status: friend_status;
  createdAt: Date;
}
