import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { notification_type } from '@prisma/client';
import { FriendUtils, successResponse, UserUtils } from 'src/utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtAccessPayload } from 'src/types';
import { NotifyService } from 'src/notify/notify.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private notifyService: NotifyService,
    private notifications: NotificationsService,
    private userUtils: UserUtils,
    private friendUtils: FriendUtils,
  ) {}

  async getFriends(payload: JwtAccessPayload) {
    const friends = await this.friendUtils.listFriends(payload.sub);
    return successResponse(friends);
  }

  async addFriend(payload: JwtAccessPayload, id: number) {
    if (payload.sub === id) throw new BadRequestException("You can't be friends with yourself.");

    const targetUser = await this.prisma.users.findUnique({
      where: { id },
      select: { id: true },
    });
    if (targetUser === null) {
      throw new NotFoundException('User not found.');
    }

    const friendsKey = this.friendUtils.getFriendsKey(payload.sub, id);

    await this.prisma.friends.create({
      data: {
        userAId: friendsKey.userAId,
        userBId: friendsKey.userBId,
        initiatorId: payload.sub,
        status: 'pending',
      },
    });
    await this.notifyPeer(payload.sub, id, 'friend_request_created');

    return successResponse(null, 'friendship request created');
  }

  async acceptFriendship(payload: JwtAccessPayload, id: number) {
    if (payload.sub === id) throw new BadRequestException("You can't be friends with yourself.");
    const friendsKey = this.friendUtils.getFriendsKey(payload.sub, id);

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

    await this.notifyPeer(payload.sub, id, 'friend_request_accepted');

    return successResponse(null, 'friendship status updated');
  }

  async deleteFriend(payload: JwtAccessPayload, id: number) {
    if (payload.sub === id) throw new BadRequestException("You can't be friends with yourself.");
    const friendsKey = this.friendUtils.getFriendsKey(payload.sub, id);

    const deletedFriend = await this.prisma.friends.delete({
      where: {
        userAId_userBId: friendsKey,
      },
    });
    this.notifyService.rmUserFromOnlineStatus(payload.sub, id);
    this.notifyService.rmUserFromOnlineStatus(id, payload.sub);

    // The peer being notified is always the other party in the canonical pair.
    // Three distinct delete semantics map to three distinct event types:
    //   - accepted friendship  → either party unfriends the other
    //   - pending, caller is initiator → initiator cancels their own request
    //   - pending, caller is recipient → recipient declines the request
    let type: notification_type;
    if (deletedFriend.status === 'accepted') {
      type = 'friend_removed';
    } else if (deletedFriend.initiatorId === payload.sub) {
      type = 'friend_request_cancelled';
    } else {
      type = 'friend_request_declined';
    }
    await this.notifyPeer(payload.sub, id, type);

    return successResponse(null, 'friendship deleted');
  }

  /**
   * Records the event in the peer's inbox and pushes it to their open tabs.
   *
   * Unconditional on purpose — the row is persisted whether or not they are
   * connected, so the username lookup that the old presence guard used to skip
   * now always runs. It feeds `params`, which is what the client renders.
   */
  private async notifyPeer(actorId: number, peerId: number, type: notification_type) {
    const actorUsername = (await this.userUtils.getUser(actorId)).username;
    await this.notifications.create({
      userId: peerId,
      type,
      actorId,
      params: { actorUsername },
    });
  }
}
