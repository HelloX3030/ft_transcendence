import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';
import type {
  ChatAck,
  ChatMessage,
  ChatReadEvent,
  DomainEvent,
  NotifyError,
  FriendsStatus,
} from '@cinemates/shared';
import { FRONTEND_ORIGIN } from '@/lib/constants';
import { toast } from 'vue-sonner';
import { logger } from '@/lib/logger';
import { invalidationMap } from '@/lib/event-router';
import { notificationText } from '@/lib/notification-text';
import { refreshSession } from '@/api/http';
import { useChatStore } from './chat';
import { useFriendsStore } from './friends';
import { useNotificationsStore } from './notifications';
import { useWatchlistsStore } from './watchlists';

/**
 * `connecting` covers socket.io's own retry loop, which never gives up on its
 * own — `offline` is this store's decision that the retries have gone on long
 * enough to be worth telling the user about.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'offline';

/** Consecutive failed handshakes before `connecting` becomes `offline`. */
const OFFLINE_AFTER_FAILED_ATTEMPTS = 5;

/** How long a send waits for its acknowledgement before it counts as failed. */
const ACK_TIMEOUT_MS = 10_000;

export const useNotifyStore = defineStore('notify', () => {
  let isInit: boolean = false;
  // Presence of the signed-in user's accepted friends, keyed by user id. Seeded
  // by the server on every (re)connect, then kept current by `online-status:<id>`.
  const friendsStatus = ref(new Map<number, boolean>());
  // The trailing path is the socket.io *namespace*, not a URL prefix — appending
  // it to BACKEND_URL (`https://localhost/api`) would ask for namespace
  // `/api/notify`, which no gateway registers. The `/api` prefix belongs in the
  // engine.io path instead, where Caddy strips it and the backend sees its
  // default `/socket.io/`.
  const socket = io(FRONTEND_ORIGIN + '/notify', {
    path: '/api/socket.io',
    withCredentials: true,
    autoConnect: false,
  });
  const connectionStatus = ref<ConnectionStatus>('idle');
  let failedAttempts = 0;
  // One refresh-and-reconnect in flight at a time. The recovery below can itself
  // be disconnected, and a handler that started another on every drop would
  // hammer the gateway with handshakes.
  let isReconnecting = false;

  // The four stores this one drives are resolved inside the handlers that use
  // them rather than here. Resolved in the setup body, they were built the
  // moment anything touched the notify store — which `useAuthStore()` does on
  // main.ts's first line, before there is a session to load anything for.
  const INVALIDATE = invalidationMap({
    refetchFriends: () => void useFriendsStore().refetchFriends(),
    invalidateWatchlists: () => useWatchlistsStore().invalidate(),
  });

  function init() {
    if (isInit) return;

    socket.removeAllListeners();

    socket.on('connect', () => {
      logger.debug('[notify] connected.');
      connectionStatus.value = 'online';
      failedAttempts = 0;
      // Also runs on every reconnect: the socket was down, so events and
      // messages were missed, and only a refetch can close that gap.
      void useNotificationsStore().load();
      void useChatStore().hydrate();
    });

    // socket.io reports a dropped connection here and only tries again after a
    // backoff, so without this handler the store would keep claiming `online`
    // through exactly the window where live updates are actually missing.
    socket.on('disconnect', (reason) => {
      logger.debug('[notify] disconnected: ', reason);
      connectionStatus.value = 'connecting';
      // socket.io retries a connection *it* lost, but never one the server asked
      // to close — so on this path `connect_error`, and the refresh that lives
      // inside it, are never reached. The gateway closes sockets whose access
      // token expired, which made every idle tab sit on 'connecting' forever
      // with chat, notifications and presence dead until a reload.
      if (reason === 'io server disconnect') void reconnectAfterServerDisconnect();
    });

    socket.on('connect_error', (error) => {
      failedAttempts += 1;
      connectionStatus.value =
        failedAttempts >= OFFLINE_AFTER_FAILED_ATTEMPTS ? 'offline' : 'connecting';
      // Routine, and already visible: a backend restart or a network blip lands
      // here repeatedly while socket.io backs off, and `connectionStatus` is what
      // tells the user. The console is not the outlet for it.
      if (!isError(error)) {
        logger.debug('[notify] invalid connect_error payload ', error);
      } else {
        logger.debug('[notify] connect error: ', error.message);
      }
      // The gateway drops sockets once their access cookie expires, and the
      // handshake then rejects the retry for the same reason. Renewing the
      // cookie lets socket.io's next attempt through instead of looping.
      void refreshSession().catch(() => {
        // Refresh token is gone too — stay offline until the user logs in again.
      });
    });

    // Not an error, and deliberately on its own channel: the gateway is asking
    // for a fresh handshake, which the `disconnect` handler above performs. It
    // fires once per access-token lifetime in a perfectly healthy app, so
    // logging it at `error` put a red line in the console every 15 minutes.
    socket.on('session_expired', () => {
      logger.debug('[notify] session expired; re-handshaking');
    });

    socket.on('error', (error) => {
      if (!isError(error)) {
        logger.error('[notify] invalid error payload ', error);
        return;
      }
      logger.error('[notify] error: ', error.message);
    });

    socket.on('exception', (error) => {
      if (!isError(error)) {
        logger.error('[notify] invalid exception payload ', error);
        return;
      }
      logger.error('[notify] exception: ', error.message);
    });

    socket.on('event', (payload) => {
      if (!isDomainEvent(payload)) {
        logger.error('[notify] invalid event payload', payload);
        return;
      }
      handleEvent(payload);
    });

    initWatchFriendsOnlineStatus();
    initChat();

    // No `watch-friends-status` emit here: the gateway seeds the presence rooms
    // and pushes the snapshot itself on every connect. Emitting from here fired
    // once and never again, so presence used to die after any reconnect — the
    // socket comes back with a new server-side id and no rooms.
    connectionStatus.value = 'connecting';
    socket.connect();
    isInit = true;
  }

  /**
   * Re-handshakes after the server closed the socket, which it does once the
   * access token behind the handshake has run out.
   *
   * Both steps are needed and neither happens on its own: the cookie has to be
   * renewed or the new handshake is rejected for the same reason, and
   * `socket.connect()` has to be explicit because socket.io does not retry a
   * server-initiated disconnect.
   */
  async function reconnectAfterServerDisconnect() {
    if (isReconnecting) return;
    isReconnecting = true;
    try {
      // Counted here as well as in `connect_error`: a socket that never retries
      // could otherwise never reach the offline ceiling, which is why the status
      // used to stick on 'connecting'. A successful `connect` resets it, so a
      // routine expiry-and-recover cycle never accumulates — five drops with no
      // connection in between is a storm, and gives up.
      failedAttempts += 1;
      if (failedAttempts >= OFFLINE_AFTER_FAILED_ATTEMPTS) {
        connectionStatus.value = 'offline';
        return;
      }
      await refreshSession();
      socket.connect();
    } catch {
      // The refresh token is gone too, so the session is genuinely over and no
      // number of retries can bring it back.
      connectionStatus.value = 'offline';
    } finally {
      isReconnecting = false;
    }
  }

  /**
   * Routes one typed event: fold it into the inbox, surface it, then invalidate
   * whatever store it makes stale. An unknown type is logged and dropped — a
   * throw here would take down the socket handler for every later event.
   */
  function handleEvent(event: DomainEvent) {
    const invalidate = INVALIDATE[event.type] as (() => void) | undefined;
    if (invalidate === undefined) {
      logger.debug('[notify] ignoring unknown event type', event.type);
      return;
    }

    useNotificationsStore().ingest(event);
    toast.info(notificationText(event.type, event.params));
    invalidate();
  }

  /** Clears the local cache only; the server keeps the inbox. */
  function stop() {
    if (!isInit) return;

    logger.debug('[notify] stop');

    // Drop the handlers before disconnecting: init() re-registers them, and
    // leaving the old ones attached would double up on the next login.
    socket.removeAllListeners();
    socket.disconnect();

    $reset();
  }

  function $reset() {
    isInit = false;
    friendsStatus.value = new Map<number, boolean>();
    connectionStatus.value = 'idle';
    failedAttempts = 0;
    isReconnecting = false;
    // Also cleared here, not just by the reset plugin on logout: the socket is
    // torn down on token expiry too, and the caches must not outlive it.
    useChatStore().$reset();
    useNotificationsStore().$reset();
  }

  function initWatchFriendsOnlineStatus() {
    socket.on('watch-friends-status', (data) => {
      if (!isFriendsStatusArray(data)) {
        logger.error('[notify] invalid friends status payload', data);
        return;
      }
      for (const user of data) {
        socket.off(`online-status:${user.id}`);
        socket.on(`online-status:${user.id}`, (update) => {
          if (!isFriendsStatus(update)) {
            logger.error('[notify] invalid presence payload', update);
            return;
          }
          friendsStatus.value.set(update.id, update.isOnline);
        });
        friendsStatus.value.set(user.id, user.isOnline);
      }
    });
    socket.on('watch-friends-status-rm', (data) => {
      if (!isFriendsStatusArray(data)) {
        logger.error('[notify] invalid friends status payload', data);
        return;
      }
      for (const user of data) {
        socket.off(`online-status:${user.id}`);
        friendsStatus.value.delete(user.id);
      }
    });
  }

  /**
   * Only friends have a presence room, so anyone absent from the map is either
   * not a friend or not yet seeded — both render as offline.
   */
  function isUserOnline(userId: number | string) {
    return friendsStatus.value.get(Number(userId)) ?? false;
  }

  /**
   * Chat rides the same socket but not the domain-event router: a message is
   * appended from its own payload rather than invalidating anything, because a
   * refetch per message would be wasteful and would fight the scroll position.
   */
  function initChat() {
    socket.on('chat.message.created', (data) => {
      if (!isChatMessage(data)) {
        logger.error('[notify] invalid chat payload', data);
        return;
      }

      const chatStore = useChatStore();
      // Opens the transcript on demand: a message can arrive from a friend the
      // user has never opened a chat with, and dropping it would lose it until
      // the next reload. `ensureChat` does not steal the current selection.
      chatStore.ingestMessage(data);

      const fromPeer = data.senderUserId === data.peerUserId;
      if (fromPeer && chatStore.activeChat?.friend.id !== data.peerUserId) {
        toast.info('You have a new chat message.');
      }
    });

    socket.on('chat.read', (data) => {
      if (!isChatReadEvent(data)) {
        logger.error('[notify] invalid chat read payload', data);
        return;
      }
      useChatStore().applyReadReceipt(data.peerUserId, data.readAt);
    });
  }

  /**
   * Sends over the socket and resolves with the server's acknowledgement.
   *
   * The ack is what lets a rejected send surface as a real error state instead
   * of a fabricated system message inside the transcript.
   *
   * Always resolves, never rejects, and always within the timeout. An emit
   * without one hands socket.io a callback it may never call — a handler that
   * throws before its body runs answers nothing, and a socket that drops mid-
   * flight discards pending callbacks silently unless they were registered with
   * a timeout, which is what `socket.timeout()` does. Either way the message
   * would otherwise stay optimistically rendered forever, with no error and no
   * way back.
   */
  function sendChatMsg(peerUserId: number, msg: string, clientMsgId: string): Promise<ChatAck> {
    return new Promise((resolve) => {
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit('chat', { peerUserId, msg, clientMsgId }, (timeout: Error | null, ack: unknown) => {
          if (timeout) {
            resolve({ ok: false, error: 'The message could not be sent. Please try again.' });
            return;
          }
          resolve(
            isChatAck(ack)
              ? ack
              : { ok: false, error: 'The server did not acknowledge the message.' },
          );
        });
    });
  }

  return {
    connectionStatus,
    friendsStatus,
    isUserOnline,
    init,
    stop,
    $reset,
    sendChatMsg,
  };
});

function isDomainEvent(value: unknown): value is DomainEvent {
  if (typeof value !== 'object' || value === null) return false;

  const event = value as Record<string, unknown>;
  return (
    typeof event.type === 'string' &&
    (event.actorId === null || typeof event.actorId === 'number') &&
    (event.entityId === null || typeof event.entityId === 'number') &&
    typeof event.params === 'object' &&
    event.params !== null &&
    (event.notificationId === null || typeof event.notificationId === 'number') &&
    typeof event.at === 'number'
  );
}

function isFriendsStatus(value: unknown): value is FriendsStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'number' &&
    'isOnline' in value &&
    typeof (value as Record<string, unknown>).isOnline === 'boolean'
  );
}

function isFriendsStatusArray(value: unknown): value is FriendsStatus[] {
  return Array.isArray(value) && value.every(isFriendsStatus);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;

  const message = value as Record<string, unknown>;
  return (
    typeof message.id === 'number' &&
    typeof message.peerUserId === 'number' &&
    typeof message.senderUserId === 'number' &&
    typeof message.body === 'string' &&
    typeof message.createdAt === 'string'
  );
}

function isChatReadEvent(value: unknown): value is ChatReadEvent {
  if (typeof value !== 'object' || value === null) return false;

  const event = value as Record<string, unknown>;
  return typeof event.peerUserId === 'number' && typeof event.readAt === 'string';
}

function isChatAck(value: unknown): value is ChatAck {
  if (typeof value !== 'object' || value === null) return false;

  const ack = value as Record<string, unknown>;
  if (ack.ok === true) return isChatMessage(ack.message);
  return ack.ok === false && typeof ack.error === 'string';
}

function isError(value: unknown): value is NotifyError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}
