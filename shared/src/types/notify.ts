/**
 * Every domain change worth telling another client about. The wire carries this
 * discriminator instead of a rendered sentence, so a client can tell *what*
 * happened and invalidate the right store — see `stores/notify.ts`.
 *
 * Declared as a value so tests can enumerate the types; the union below is
 * derived from it, which keeps the two from drifting apart.
 */
export const DOMAIN_EVENT_TYPES = [
  "friend.request.created",
  "friend.request.accepted",
  "friend.request.declined",
  "friend.request.cancelled",
  "friend.removed",
  "watchlist.user.added",
  "watchlist.user.removed",
  "watchlist.movie.added",
  "watchlist.movie.removed",
  "watchlist.deleted",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export interface DomainEvent {
  type: DomainEventType;
  /** Who caused it. Null for system-generated events. */
  actorId: number | null;
  /** Subject of the event: watchlist id, etc. Null where not applicable. */
  entityId: number | null;
  /** Snapshot of the values needed to render the message. */
  params: Record<string, string>;
  /** Present when this event also created an inbox row. */
  notificationId: number | null;
  /** Server epoch ms. */
  at: number;
}

/** One persisted inbox row, as served by `GET /notifications`. */
export interface NotificationItem {
  id: number;
  type: DomainEventType;
  actorId: number | null;
  entityId: number | null;
  params: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  notifications: NotificationItem[];
  /** Opaque; pass back as `cursor` to fetch the next page. Null at the end. */
  nextCursor: string | null;
  unreadCount: number;
}

export interface UnreadCount {
  unreadCount: number;
}

export interface FriendsStatus {
  id: number;
  isOnline: boolean;
}

export interface ChatMsgSend {
  peerUserId: number;
  msg: string;
  /**
   * Client-generated id, echoed back untouched. The sender's own tabs receive
   * the broadcast too, so without it an optimistically rendered message would
   * appear twice.
   */
  clientMsgId: string;
}

/** One persisted message, as served over REST and pushed over the socket. */
export interface ChatMessage {
  id: number;
  /** The other party, from the perspective of whoever receives this payload. */
  peerUserId: number;
  senderUserId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
  clientMsgId?: string;
}

export interface ChatMessagePage {
  /** Ascending, so the client can prepend a page without reversing it. */
  messages: ChatMessage[];
  nextCursor: string | null;
}

export interface ChatConversation {
  peerUserId: number;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

/** Socket.io acknowledgement returned by the `chat` handler. */
export type ChatAck = { ok: true; message: ChatMessage } | { ok: false; error: string };

/** Emitted to the peer when their messages in a conversation are marked read. */
export interface ChatReadEvent {
  peerUserId: number;
  readAt: string;
}

/** What POST /chat/:peerId/read answers with. */
export interface ChatReadResponse {
  readAt: string;
  /** How many of the peer's messages this call actually marked. */
  count: number;
}

/** Payload of the `error` event. A genuine fault the client could not foresee. */
export interface NotifyError {
  message: string;
}

/**
 * Payload of the `session_expired` event.
 *
 * Deliberately not an `error`: the gateway only checks the access token during
 * the handshake, so it drops sockets whose token has since run out. That is a
 * routine request to re-handshake, not a failure — the client renews the cookie
 * and reconnects. Sending it on the `error` channel put a console error in front
 * of every user every time their access token aged out.
 */
export interface NotifySessionExpired {
  message: string;
}
