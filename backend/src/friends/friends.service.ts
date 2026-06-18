import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Friend, FriendKey, JwtAccessPayload } from 'src/types';

export const FRIENDS_SELECT = {
  friendsA: true,
  friendsB: true,
} as const;

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async getFriends(payload: JwtAccessPayload) {
    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      select: FRIENDS_SELECT,
    });

    if (user === null) throw new InternalServerErrorException();

    const friends: Friend[] = [];

    user.friendsA.forEach((friend) => {
      friends.push({
        friendId: friend.userBId,
        status: friend.status,
        createdAt: friend.createdAt,
      });
    });

    user.friendsB.forEach((friend) => {
      friends.push({
        friendId: friend.userAId,
        status: friend.status,
        createdAt: friend.createdAt,
      });
    });
    return { friends: friends };
  }

  async addFriend(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);

    await this.prisma.friends.create({
      data: {
        userAId: friendsKey.userAId,
        userBId: friendsKey.userBId,
        initiatorId: payload.sub,
        status: 'pending',
      },
    });
    return { message: 'friendship request created' };
  }

  async acceptFriendship(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);

    const friendship = await this.prisma.friends.findUnique({
      where: {
        userAId_userBId: friendsKey,
      },
    });

    if (friendship === null) throw new NotFoundException('This friendship does not exist.');

    if (friendship.status === 'pending' && friendship.initiatorId === payload.sub) {
      throw new BadRequestException('You cannot accept your own friendship request.');
    }

    if (friendship.status === 'accepted') {
      throw new BadRequestException('Friendship is already accepted.');
    }

    await this.prisma.friends.update({
      where: {
        userAId_userBId: friendsKey,
      },
      data: {
        status: 'accepted',
      },
    });

    return { message: 'friendship status updated' };
  }

  async deleteFriend(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);
    await this.prisma.friends.delete({
      where: {
        userAId_userBId: friendsKey,
      },
    });
    return { message: 'friendship deleted' };
  }

  getFriendsKey(userXId: number, userYId: number): FriendKey {
    if (userXId === userYId) throw new BadRequestException("You can't be friends with yourself.");
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
