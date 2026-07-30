import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { notification_type, notifications, Prisma } from '@prisma/client';
import { NotificationItem, NotificationPage } from '@trailertinder/shared';
import { NotifyService } from 'src/notify/notify.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { decodeCursor, encodeCursor, olderThanCursor, successResponse } from 'src/utils';
import { ListNotificationsDto } from './dto';
import { EVENT_TYPE } from './notification-events';
import { daysAgo, MAX_RETENTION_DAYS, READ_RETENTION_DAYS } from './retention.config';

export interface CreateNotification {
  /** Who receives it. */
  userId: number;
  type: notification_type;
  /** Who caused it. Null for system-generated events. */
  actorId?: number | null;
  /** Watchlist id and the like — whatever the client needs to deep-link to. */
  entityId?: number | null;
  /** Snapshot of the values the client interpolates into its template. */
  params?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
  ) {}

  // -------------------------
  // Write path
  // -------------------------

  /**
   * Persists an inbox row, then pushes it to whichever tabs happen to be open.
   *
   * Write-then-emit, never the reverse and never conditional on presence: the
   * row is the source of truth and the socket is only the fast path, so an
   * offline recipient simply finds the notification on their next load.
   */
  async create(input: CreateNotification): Promise<void> {
    const params = input.params ?? {};

    const row = await this.prisma.notifications.create({
      data: {
        userId: input.userId,
        type: input.type,
        actorId: input.actorId ?? null,
        entityId: input.entityId ?? null,
        params,
      },
      select: { id: true, createdAt: true },
    });

    this.notify.sendEvent(input.userId, {
      type: EVENT_TYPE[input.type],
      actorId: input.actorId ?? null,
      entityId: input.entityId ?? null,
      params,
      notificationId: row.id,
      at: row.createdAt.getTime(),
    });
  }

  /** Same as {@link create} for a list of recipients, skipping `exceptUserId`. */
  async createMany(
    userIds: number[],
    input: Omit<CreateNotification, 'userId'> & { exceptUserId?: number },
  ): Promise<void> {
    for (const userId of userIds) {
      if (userId === input.exceptUserId) continue;
      await this.create({ ...input, userId });
    }
  }

  // -------------------------
  // Read path
  // -------------------------

  async list(userId: number, dto: ListNotificationsDto) {
    const { limit } = dto;
    const where: Prisma.notificationsWhereInput = {
      userId,
      ...(dto.unreadOnly ? { readAt: null } : {}),
      ...(dto.cursor ? { OR: olderThanCursor(decodeCursor(dto.cursor)) } : {}),
    };

    const [rows, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        // Matches the (user_id, created_at DESC, id DESC) index, so the page is
        // one range scan with no sort step.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.countUnread(userId),
    ]);

    const page: NotificationPage = {
      notifications: rows.map((row) => this.toItem(row)),
      // A short page means the table is exhausted; anything else would send the
      // client back for a page that is already known to be empty.
      nextCursor: rows.length < limit ? null : encodeCursor(rows[rows.length - 1]),
      unreadCount,
    };
    return successResponse(page);
  }

  async unreadCount(userId: number) {
    return successResponse({ unreadCount: await this.countUnread(userId) });
  }

  // -------------------------
  // Mutations
  // -------------------------

  async markRead(userId: number, id: number) {
    // updateMany, not update: scoping on userId in the *where* makes another
    // user's row a no-op (404) instead of a successful cross-account write.
    const { count } = await this.prisma.notifications.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) await this.assertExists(userId, id);

    return successResponse({ unreadCount: await this.countUnread(userId) });
  }

  async markAllRead(userId: number) {
    await this.prisma.notifications.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return successResponse({ unreadCount: 0 });
  }

  async remove(userId: number, id: number) {
    const { count } = await this.prisma.notifications.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Notification not found.');

    return successResponse({ unreadCount: await this.countUnread(userId) });
  }

  async clear(userId: number) {
    await this.prisma.notifications.deleteMany({ where: { userId } });
    return successResponse({ unreadCount: 0 });
  }

  // -------------------------
  // Retention
  // -------------------------

  /**
   * Bounds table growth. Without it the inbox is append-only forever, since
   * nothing else ever deletes a row the user did not delete by hand.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneExpired(now: number = Date.now()): Promise<number> {
    const { count } = await this.prisma.notifications.deleteMany({
      where: {
        OR: [
          { readAt: { not: null, lt: daysAgo(READ_RETENTION_DAYS, now) } },
          { createdAt: { lt: daysAgo(MAX_RETENTION_DAYS, now) } },
        ],
      },
    });
    if (count > 0) this.logger.log(`Pruned ${count} expired notifications`);
    return count;
  }

  // -------------------------
  // Internals
  // -------------------------

  private countUnread(userId: number): Promise<number> {
    return this.prisma.notifications.count({ where: { userId, readAt: null } });
  }

  /** Tells "already read" (fine) apart from "not yours / gone" (404). */
  private async assertExists(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.notifications.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (existing === null) throw new NotFoundException('Notification not found.');
  }

  private toItem(row: notifications): NotificationItem {
    return {
      id: row.id,
      type: EVENT_TYPE[row.type],
      actorId: row.actorId,
      entityId: row.entityId,
      params: toParams(row.params),
      readAt: row.readAt === null ? null : row.readAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}

/**
 * `params` is a Json column, so the type system cannot promise what came back
 * out of it. Anything that is not a string map renders as an empty one rather
 * than crashing the whole page.
 */
function toParams(value: Prisma.JsonValue): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') params[key] = entry;
  }
  return params;
}
