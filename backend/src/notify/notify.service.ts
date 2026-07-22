import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';
import { NotifyMsg } from '@trailertinder/shared';
import type { NotifySocket as Socket } from 'src/types';
import { FriendUtils } from 'src/utils';
import { ChatRequiremtnsException } from './exceptions/chat-requirements-exception';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  // map: userId, clientCount
  private readonly userStatus = new Map<number, Set<Socket>>();

  constructor(
    @Inject(forwardRef(() => NotifyGateway))
    private readonly notifyGateway: NotifyGateway,
    private readonly friendUtils: FriendUtils,
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

  getUserSockets(userId: number) {
    const sockets = this.userStatus.get(userId);
    if (sockets !== undefined) return sockets;
    else throw new Error('User is offline.');
  }

  // -------------------------
  // Send Notifications
  // -------------------------
  sendNotify(userId: number, message: NotifyMsg) {
    this.notifyGateway.sendNotification(userId, message);
  }

  // -------------------------
  // User Chat
  // -------------------------
  async hasChatRequirements(meUserId: number, peerUserId: number) {
    const isFriend = await this.friendUtils.areFriends(meUserId, peerUserId);
    if (!isFriend) throw new ChatRequiremtnsException('You are not friends with this user.');

    const isOnline = this.userStatus.get(peerUserId) !== undefined;
    if (!isOnline) throw new ChatRequiremtnsException('The user is offline.');
  }
}
