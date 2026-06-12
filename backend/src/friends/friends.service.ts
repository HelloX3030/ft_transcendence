import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
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
        friendId: friend.userBId,
        status: friend.status,
        createdAt: friend.createdAt,
      });
    });
    return { friends: friends };
  }

  async addFriend(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);

    try {
      await this.prisma.friends.create({
        data: {
          userAId: friendsKey.userAId,
          userBId: friendsKey.userBId,
          initiatorId: payload.sub,
          status: 'pending',
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('This friendship already exists.');
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('The user ID is invalid.');
        }
      }
      console.error(error);
      throw new InternalServerErrorException();
    }
    return { message: 'friendship request created' };
  }

  async acceptFriendship(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);

    try {
      const friendship = await this.prisma.friends.findUnique({
        where: {
          userAId_userBId: friendsKey,
        },
      });

      if (friendship === null) throw new BadRequestException('This friendship does not exist.');

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
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new NotFoundException('This friendship does not exist.');
        }
        console.error(error);
        throw new InternalServerErrorException();
      }
      throw error;
    }
    return { message: 'friendship status updated' };
  }

  async deleteFriend(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);

    try {
      await this.prisma.friends.delete({
        where: {
          userAId_userBId: friendsKey,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('This friendship does not exist.');
      }
    }
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
