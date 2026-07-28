import { Injectable, NotFoundException } from '@nestjs/common';
import { Friend } from '@trailertinder/shared';
import { PrismaService } from 'src/prisma/prisma.service';
import { FriendKey } from 'src/types';

@Injectable()
export class FriendUtils {
  constructor(private prisma: PrismaService) {}

  async areFriends(userAId: number, userBId: number): Promise<boolean> {
    const friendsKey = this.getFriendsKey(userAId, userBId);
    const friendShip = await this.prisma.friends.findUnique({
      where: {
        userAId_userBId: friendsKey,
      },
      select: {
        status: true,
      },
    });
    if (friendShip === null || friendShip.status === 'pending') {
      return false;
    }
    return true;
  }

  /**
   * All friendships of `userId` (both directions of the canonical pair),
   * normalized so `friendId` is always the *other* party. Single source of the
   * `friendsA`/`friendsB` unpacking — project from this instead of re-querying.
   */
  async listFriends(userId: number): Promise<Friend[]> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        friendsA: true,
        friendsB: true,
      },
    });

    if (user === null) {
      throw new NotFoundException('User not found.');
    }

    const friends: Friend[] = [];

    user.friendsA.forEach((friend) => {
      friends.push({
        friendId: friend.userBId,
        status: friend.status,
        initiatorId: friend.initiatorId,
        createdAt: friend.createdAt,
      });
    });

    user.friendsB.forEach((friend) => {
      friends.push({
        friendId: friend.userAId,
        status: friend.status,
        initiatorId: friend.initiatorId,
        createdAt: friend.createdAt,
      });
    });
    return friends;
  }

  /** Accepted friends' user IDs — used to wire up presence rooms. */
  async getFriends(userId: number): Promise<number[]> {
    const friends = await this.listFriends(userId);
    return friends
      .filter((friend) => friend.status === 'accepted')
      .map((friend) => friend.friendId);
  }

  getFriendsKey(userXId: number, userYId: number): FriendKey {
    if (userXId < userYId) {
      return {
        userAId: userXId,
        userBId: userYId,
      };
    }
    return {
      userAId: userYId,
      userBId: userXId,
    };
  }
}
