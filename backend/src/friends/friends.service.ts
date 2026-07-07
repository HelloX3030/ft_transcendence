import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Friend } from '@trailertinder/shared';
import {
  FRIEND_REMOVED,
  FRIEND_REQUEST_ACCEPTED,
  FRIENDS_TITEL,
  NEW_FRIEND_REQUEST,
  successResponse,
  UserUtils,
} from 'src/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { FriendKey, JwtAccessPayload } from 'src/types';
import { NotifyService } from 'src/notify/notify.service';

export const FRIENDS_SELECT = {
  friendsA: true,
  friendsB: true,
} as const;

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private notifyService: NotifyService,
    private userUtils: UserUtils,
  ) {}

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
    return successResponse(friends);
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
    const username = (await this.userUtils.getUser(payload.sub)).username;
    this.notifyService.sendNotify(id, {
      titel: FRIENDS_TITEL,
      msg: NEW_FRIEND_REQUEST(username),
    });
    return successResponse(null, 'friendship request created');
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

    this.notifyService.addUserToOnlineStatus(payload.sub, id);
    this.notifyService.addUserToOnlineStatus(id, payload.sub);

    const username = (await this.userUtils.getUser(payload.sub)).username;
    this.notifyService.sendNotify(id, {
      titel: FRIENDS_TITEL,
      msg: FRIEND_REQUEST_ACCEPTED(username),
    });

    return successResponse(null, 'friendship status updated');
  }

  async deleteFriend(payload: JwtAccessPayload, id: number) {
    const friendsKey = this.getFriendsKey(payload.sub, id);
    await this.prisma.friends.delete({
      where: {
        userAId_userBId: friendsKey,
      },
    });
    this.notifyService.rmUserFromOnlineStatus(payload.sub, id);
    this.notifyService.rmUserFromOnlineStatus(id, payload.sub);

    const username = (await this.userUtils.getUser(payload.sub)).username;
    this.notifyService.sendNotify(id, {
      titel: FRIENDS_TITEL,
      msg: FRIEND_REMOVED(username),
    });

    return successResponse(null, 'friendship deleted');
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
