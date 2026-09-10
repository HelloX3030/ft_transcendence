import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { NotifyGateway } from './notify.gateway';
import { ChatMessage, ChatReadEvent, DomainEvent } from '@cinemates/shared';
import type { NotifySocket as Socket } from 'src/types';
import { MetricsService } from 'src/metrics/metrics.service';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  private readonly userStatus = new Map<number, Set<Socket>>();

  constructor(
    @Inject(forwardRef(() => NotifyGateway))
    private readonly notifyGateway: NotifyGateway,
    private readonly metrics: MetricsService,
  ) {}

  setUserAsActive(userId: number, client: Socket) {
    const cSocketSet = this.userStatus.get(userId) ?? new Set();
    cSocketSet.add(client);
    this.userStatus.set(userId, cSocketSet);
    this.syncPresenceGauges();
    this.logger.debug('User ' + userId + ' set to active.');
  }

  setUserAsInactive(userId: number, client: Socket) {
    const cSocketSet = this.userStatus.get(userId);
    if (cSocketSet === undefined) {
      this.logger.error('The user could not be removed from the active list.');
      return;
    }
    cSocketSet.delete(client);
    if (cSocketSet.size == 0) this.userStatus.delete(userId);
    this.syncPresenceGauges();
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
    return this.userStatus.has(userId);
  }

  /**
   * Pushes a typed domain event to every tab of `userId`. Fire-and-forget by
   * design: the caller has already persisted whatever needs to survive, so a
   * recipient with no open socket is not an error.
   */
  sendEvent(userId: number, event: DomainEvent) {
    this.metrics.recordWsEventSent('domain');
    this.notifyGateway.sendDomainEvent(userId, event);
  }

  sendChatMessage(userId: number, message: ChatMessage) {
    this.metrics.recordWsEventSent('chat_message');
    this.notifyGateway.sendChatMessage(userId, message);
  }

  sendChatRead(userId: number, event: ChatReadEvent) {
    this.metrics.recordWsEventSent('chat_read');
    this.notifyGateway.sendChatRead(userId, event);
  }

  /**
   * Re-publishes both presence gauges from this map, which is the only
   * authority on who is online. Set from the map rather than incremented and
   * decremented alongside it: a counter pair drifts permanently the first time
   * a branch mutates the map without touching it, and the map is small enough
   * that recounting costs nothing.
   */
  private syncPresenceGauges() {
    let openSockets = 0;
    for (const sockets of this.userStatus.values()) openSockets += sockets.size;
    this.metrics.setPresence(this.userStatus.size, openSockets);
  }
}
