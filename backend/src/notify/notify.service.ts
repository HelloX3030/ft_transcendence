import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';
import { PrismaService } from 'src/prisma/prisma.service';
import { Socket } from 'socket.io';

@Injectable()
export class NotifyService {
  // map: userId, clientCount
  private readonly userStatus = new Map<number, Set<Socket>>();

  constructor(
    @Inject(forwardRef(() => NotifyGateway))
    private readonly notifyGateway: NotifyGateway,
    private readonly prisma: PrismaService,
  ) {}

  setUserAsActive(userId: number, client: Socket) {
    const cSocketSet = this.userStatus.get(userId) ?? new Set();
    cSocketSet.add(client);
    this.userStatus.set(userId, cSocketSet);
    console.log('User ' + userId + ' set to Active ');
  }

  setUserAsInative(userId: number, client: Socket) {
    const cSocketSet = this.userStatus.get(userId);
    if (cSocketSet === undefined) {
      console.error('The user could not be removed from the active list.');
      return;
    }
    cSocketSet.delete(client);
    if (cSocketSet.size == 0) this.userStatus.delete(userId);
    console.log('User ' + userId + ' set to InActive ');
  }

  sendNotify(message: string, userId: number) {
    this.notifyGateway.sendMessage(message, userId);
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
    // todo: add remove also to the client
  }

  isOnline(userId: number) {
    if (this.userStatus.get(userId) !== undefined) return true;
    else return false;
  }

  async getFreinds(userId: number): Promise<number[]> {
    const user = await this.prisma.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        friendsA: {
          where: {
            //status: 'accepted', // todo: aktivate accepted
          },
        },
        friendsB: {
          where: {
            //status: 'accepted', // todo: aktivate accepted
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
