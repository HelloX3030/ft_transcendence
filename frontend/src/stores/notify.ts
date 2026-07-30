import { ref } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { io } from 'socket.io-client';
import type { ChatMsgRecive, DomainEvent, NotifyError, FriendsStatus } from '@trailertinder/shared';
import { BACKEND_URL } from '@/lib/constants';
import { toast } from 'vue-sonner';
import { logger } from '@/lib/logger';
import { invalidationMap } from '@/lib/event-router';
import { notificationText } from '@/lib/notification-text';
import { refreshSession } from '@/api/client';
import { useChatStore } from './chat';
import { useFriendsStore } from './friends';
import { useNotificationsStore } from './notifications';
import { useWatchlistsStore } from './watchlists';

export const useNotifyStore = defineStore('notify', () => {
  let isInit: boolean = false;
  // Presence of the signed-in user's accepted friends, keyed by user id. Seeded
  // by the server on every (re)connect, then kept current by `online-status:<id>`.
  const friendsStatus = ref(new Map<number, boolean>());
  const socket = io(BACKEND_URL + '/notify', { withCredentials: true, autoConnect: false });
  const SYSTEM_SENDER_ID = -1;
  const offline = ref<boolean>(true);

  const chatStore = useChatStore();
  const friendsStore = useFriendsStore();
  const notificationsStore = useNotificationsStore();
  const watchlistsStore = useWatchlistsStore();
  const { friendsDetails } = storeToRefs(friendsStore);

  const INVALIDATE = invalidationMap({
    refetchFriends: () => void friendsStore.refetchFriends(),
    invalidateWatchlists: () => watchlistsStore.invalidate(),
  });

  function init() {
    if (isInit) return;

    socket.removeAllListeners();

    socket.on('connect', () => {
      logger.debug('[notify] connected.');
      offline.value = false;
      // Also runs on every reconnect: the socket was down, so events were missed
      // and only a refetch can close that gap.
      void notificationsStore.load();
    });

    socket.on('connect_error', (error) => {
      offline.value = true;
      if (!isError(error)) {
        logger.error('[notify] invalid connect_error payload ', error);
      } else {
        logger.error('[notify] connect error: ', error.message);
      }
      // The gateway drops sockets once their access cookie expires, and the
      // handshake then rejects the retry for the same reason. Renewing the
      // cookie lets socket.io's next attempt through instead of looping.
      void refreshSession().catch(() => {
        // Refresh token is gone too — stay offline until the user logs in again.
      });
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
    socket.connect();
    isInit = true;
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

    notificationsStore.ingest(event);
    toast.info(notificationText(event.type, event.params));
    invalidate();
  }

  /** Clears the local cache only; the server keeps the inbox. */
  function stop() {
    socket.close();
    isInit = false;
    friendsStatus.value = new Map();
    offline.value = true;
    chatStore.reset();
    notificationsStore.reset();
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

  function initChat() {
    socket.on('chat', (data) => {
      if (!isChatMsgRecive(data)) {
        logger.error('[notify] invalid chat payload', data);
        return;
      }

      // Open the transcript on demand: a message can arrive from a friend the
      // user has never opened a chat with, and dropping it would lose it for
      // good. `ensureChat` does not steal the current selection.
      const chat = chatStore.ensureChat(
        data.peerUserId,
        friendsDetails.value.find((friend) => friend.id === data.peerUserId),
      );
      // The server stamps one time for every copy of a message, so all tabs and
      // both participants agree on the ordering.
      chatStore.addMessage(chat, data.senderUserId, data.msg, new Date(data.time).toISOString());

      // Chat has no inbox row of its own yet, so only the transient toast.
      if (data.senderUserId === data.peerUserId) toast.info('You have a new chat message.');
    });
  }

  function sendChatMsg(peerUserId: number, msg: string) {
    socket.emit('chat', { peerUserId, msg });
  }

  return {
    SYSTEM_SENDER_ID,
    offline,
    friendsStatus,
    isUserOnline,
    init,
    stop,
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

function isChatMsgRecive(value: unknown): value is ChatMsgRecive {
  return (
    typeof value === 'object' &&
    value !== null &&
    'peerUserId' in value &&
    typeof (value as Record<string, unknown>).peerUserId === 'number' &&
    'senderUserId' in value &&
    typeof (value as Record<string, unknown>).senderUserId === 'number' &&
    'time' in value &&
    typeof (value as Record<string, unknown>).time === 'number' &&
    'msg' in value &&
    typeof (value as Record<string, unknown>).msg === 'string'
  );
}

function isError(value: unknown): value is NotifyError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}
