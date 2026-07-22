import { Injectable } from '@nestjs/common';
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

  async getFreinds(userId: number): Promise<number[]> {
    const user = await this.prisma.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        friendsA: {
          where: {
            status: 'accepted',
          },
        },
        friendsB: {
          where: {
            status: 'accepted',
          },
        },
      },
    });

    if (user === null) {
      throw new Error('The user cannot be found.');
    }

    const friends: number[] = [];

    user.friendsA.forEach((friend) => {
      friends.push(friend.userBId);
    });

    user.friendsB.forEach((friend) => {
      friends.push(friend.userAId);
    });
    return friends;
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
