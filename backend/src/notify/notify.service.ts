import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { Socket } from 'socket.io';
import { NotifyMsg } from '@trailertinder/shared';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  // map: userId, clientCount
  private readonly userStatus = new Map<number, Set<Socket>>();

  constructor(
    @Inject(forwardRef(() => NotifyGateway))
    private readonly notifyGateway: NotifyGateway,
    private readonly prisma: PrismaService,
  ) {}

  // -------------------------
  // User online Status
  // -------------------------
  setUserAsActive(userId: number, client: Socket) {
    const cSocketSet = this.userStatus.get(userId) ?? new Set();
    cSocketSet.add(client);
    this.userStatus.set(userId, cSocketSet);
    this.logger.debug('User ' + userId + ' set to active.');
  }

  setUserAsInative(userId: number, client: Socket) {
    const cSocketSet = this.userStatus.get(userId);
    if (cSocketSet === undefined) {
      this.logger.error('The user could not be removed from the active list.');
      return;
    }
    cSocketSet.delete(client);
    if (cSocketSet.size == 0) this.userStatus.delete(userId);
    this.logger.debug('User ' + userId + ' set to inactive.');
  }

  addUserToOnlineStatus(monitoringUser: number, userIdToMonitor: number) {
    const userClient = this.userStatus.get(monitoringUser);
    if (userClient === undefined) return;
    for (const client of userClient) {
      this.notifyGateway.addClientToStatusUpdate(client, userIdToMonitor);
    }
  }

  rmUserFromOnlineStatus(monitoringUser: number, userIdToMonitor: number) {
    const userClient = this.userStatus.get(monitoringUser);
    if (userClient === undefined) return;
    for (const client of userClient) {
      this.notifyGateway.rmClientFromStatusUpdate(client, userIdToMonitor);
    }
  }

  isOnline(userId: number) {
    if (this.userStatus.get(userId) !== undefined) return true;
    else return false;
  }

  // -------------------------
  // Send Notifications
  // -------------------------
  sendNotify(userId: number, message: NotifyMsg) {
    this.notifyGateway.sendNotification(userId, message);
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
}
