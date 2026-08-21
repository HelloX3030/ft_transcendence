import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { messages, Prisma } from '@prisma/client';
import {
  ChatConversation,
  ChatMessage,
  ChatMessagePage,
  ChatReadResponse,
  MESSAGE_MAX_LENGTH,
} from '@cinemates/shared';
import { NotifyService } from 'src/notify/notify.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { daysAgo, MESSAGE_RETENTION_DAYS } from 'src/retention.config';
import {
  decodeCursor,
  encodeCursor,
  FriendUtils,
  olderThanCursor,
  successResponse,
} from 'src/utils';
import { ChatMsgDto, ListMessagesDto } from './dto';

/** Newest message per conversation, as returned by the DISTINCT ON query. */
type LastMessageRow = messages;

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly friendUtils: FriendUtils,
    @Inject(forwardRef(() => NotifyService))
    private readonly notify: NotifyService,
  ) {}

  /**
   * The cron below only fires while the app happens to be up at 3am, which a
   * stack that is started for a demo and stopped again never is. Sweeping once
   * at boot is what makes the retention window hold in practice rather than
   * only on paper. Failing is not fatal: the next boot sweeps the same rows.
   */
  async onModuleInit() {
    try {
      await this.pruneExpired();
    } catch (err) {
      this.logger.warn(`Startup message prune failed: ${(err as Error).message}`);
    }
  }

  /**
   * Persists one message after re-authorising the sender. The friendship check
   * runs on every message: history outlives the friendship (`deleteFriend`
   * touches no messages), so a conversation can exist between two non-friends.
   */
  async send(senderId: number, dto: ChatMsgDto): Promise<ChatMessage> {
    // Explicit, rather than relying on `areFriends(me, me)` finding no row:
    // that is an accident of the data, and produces a misleading error.
    if (senderId === dto.peerUserId) {
      throw new BadRequestException('You cannot message yourself.');
    }

    // The DTO already trims and bounds this; repeated because the service is
    // reachable without the gateway's validation pipe, and a VarChar(2000)
    // violation would surface as a 500 rather than a 400.
    const body = dto.msg.trim();
    if (body === '') throw new BadRequestException('A message cannot be empty.');
    if (body.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(`A message cannot exceed ${MESSAGE_MAX_LENGTH} characters.`);
    }

    const isFriend = await this.friendUtils.areFriends(senderId, dto.peerUserId);
    if (!isFriend) throw new ForbiddenException('You are not friends with this user.');

    const key = this.friendUtils.getFriendsKey(senderId, dto.peerUserId);

    const row = await this.prisma.messages.create({
      data: { ...key, senderId, body },
    });

    return this.toMessage(row, dto.peerUserId, dto.clientMsgId);
  }

  /**
   * One page of history, newest first internally but returned ascending.
   *
   * Authorisation is structural: the pair key is built from the caller and the
   * peer, so a third party can only address their own conversation. Reading
   * requires participation, not a current friendship.
   */
  async getMessages(userId: number, peerId: number, dto: ListMessagesDto) {
    const { limit } = dto;
    const key = this.friendUtils.getFriendsKey(userId, peerId);

    const rows = await this.prisma.messages.findMany({
      where: {
        ...key,
        ...(dto.before ? { OR: olderThanCursor(decodeCursor(dto.before)) } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const page: ChatMessagePage = {
      // Fetched descending (that is what the index and the cursor want), served
      // ascending so the client can prepend a page without reversing it.
      messages: rows.map((row) => this.toMessage(row, peerId)).reverse(),
      nextCursor: rows.length < limit ? null : encodeCursor(rows[rows.length - 1]),
    };
    return successResponse(page);
  }

  /**
   * One entry per accepted friend, ordered by recency. Friend-derived on purpose:
   * an ex-friend's conversation leaves the list but stays fetchable at
   * `GET /chat/:peerId/messages`, so re-friending brings the history back.
   */
  async getConversations(userId: number) {
    const friendIds = await this.friendUtils.getFriends(userId);
    if (friendIds.length === 0) return successResponse<ChatConversation[]>([]);

    const [lastMessages, unread] = await Promise.all([
      this.lastMessagePerConversation(userId),
      this.unreadPerConversation(userId),
    ]);

    const conversations: ChatConversation[] = friendIds.map((peerUserId) => ({
      peerUserId,
      lastMessage: lastMessages.get(peerUserId) ?? null,
      unreadCount: unread.get(peerUserId) ?? 0,
    }));

    // Conversations with no messages sink to the bottom rather than sorting as
    // if they were infinitely old.
    conversations.sort((a, b) => {
      const aAt = a.lastMessage?.createdAt ?? '';
      const bAt = b.lastMessage?.createdAt ?? '';
      return bAt.localeCompare(aAt);
    });

    return successResponse(conversations);
  }

  /** Marks everything the peer sent in this conversation as read. */
  async markRead(userId: number, peerId: number) {
    const key = this.friendUtils.getFriendsKey(userId, peerId);
    const readAt = new Date();

    const { count } = await this.prisma.messages.updateMany({
      where: { ...key, senderId: peerId, readAt: null },
      data: { readAt },
    });

    // Nothing renders read receipts yet, but the peer needs the signal for that
    // to be addable without another round of protocol work.
    if (count > 0) {
      this.notify.sendChatRead(peerId, { peerUserId: userId, readAt: readAt.toISOString() });
    }

    const response: ChatReadResponse = { readAt: readAt.toISOString(), count };
    return successResponse(response);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneExpired(now: number = Date.now()): Promise<number> {
    const { count } = await this.prisma.messages.deleteMany({
      where: { createdAt: { lt: daysAgo(MESSAGE_RETENTION_DAYS, now) } },
    });
    if (count > 0) this.logger.log(`Pruned ${count} expired messages`);
    return count;
  }

  /**
   * Newest message of every conversation `userId` takes part in, in one query.
   * `DISTINCT ON` has no Prisma equivalent, and the alternative is one query per
   * friend. The ORDER BY prefix must match the DISTINCT ON columns, which is what
   * makes the first row per group the newest.
   */
  private async lastMessagePerConversation(userId: number): Promise<Map<number, ChatMessage>> {
    const rows = await this.prisma.$queryRaw<LastMessageRow[]>`
      SELECT DISTINCT ON (user_a_id, user_b_id)
             id, user_a_id AS "userAId", user_b_id AS "userBId",
             sender_id AS "senderId", body, read_at AS "readAt", created_at AS "createdAt"
      FROM messages
      WHERE user_a_id = ${userId} OR user_b_id = ${userId}
      ORDER BY user_a_id, user_b_id, created_at DESC, id DESC
    `;

    const byPeer = new Map<number, ChatMessage>();
    for (const row of rows) {
      const peerId = row.userAId === userId ? row.userBId : row.userAId;
      byPeer.set(peerId, this.toMessage(row, peerId));
    }
    return byPeer;
  }

  /**
   * Unread counts scoped per conversation, which is what the
   * `(userAId, userBId, readAt)` index serves. A global count would need an
   * indexed `recipientId`, deliberately not denormalised yet.
   */
  private async unreadPerConversation(userId: number): Promise<Map<number, number>> {
    const groups = await this.prisma.messages.groupBy({
      by: ['userAId', 'userBId'],
      where: {
        readAt: null,
        senderId: { not: userId },
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      _count: { _all: true },
    });

    const byPeer = new Map<number, number>();
    for (const group of groups) {
      const peerId = group.userAId === userId ? group.userBId : group.userAId;
      byPeer.set(peerId, group._count._all);
    }
    return byPeer;
  }

  private toMessage(row: messages, peerUserId: number, clientMsgId?: string): ChatMessage {
    return {
      id: row.id,
      peerUserId,
      senderUserId: row.senderId,
      body: row.body,
      readAt: row.readAt === null ? null : row.readAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      ...(clientMsgId === undefined ? {} : { clientMsgId }),
    };
  }
}

/**
 * A foreign key violation on send means the peer's account disappeared between
 * the friendship check and the insert. The HTTP Prisma filter does not cover
 * socket handlers, so the gateway has to name this itself.
 */
export function isMissingParticipant(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}
