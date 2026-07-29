import { ref } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { io } from 'socket.io-client';
import type { ChatMsgRecive, NotifyError, FriendsStatus, NotifyMsg } from '@trailertinder/shared';
import { BACKEND_URL } from '@/lib/constants';
import { toast } from 'vue-sonner';
import { logger } from '@/lib/logger';
import { refreshSession } from '@/api/client';
import { useChatStore } from './chat';
import { useFriendsStore } from './friends';

export const useNotifyStore = defineStore('notify', () => {
  let isInit: boolean = false;
  const count = ref<number>(0);
  const notifyId = ref<number>(0);
  const notifyMsg = ref<{ id: number; title: string; msg: string; date: string }[]>([]);
  // Presence of the signed-in user's accepted friends, keyed by user id. Seeded
  // by the server on every (re)connect, then kept current by `online-status:<id>`.
  const friendsStatus = ref(new Map<number, boolean>());
  const socket = io(BACKEND_URL + '/notify', { withCredentials: true, autoConnect: false });
  const SYSTEM_SENDER_ID = -1;
  const offline = ref<boolean>(true);

  const chatStore = useChatStore();
  const friendsStore = useFriendsStore();
  const { friendsDetails } = storeToRefs(friendsStore);

  function init() {
    if (isInit) return;

    socket.removeAllListeners();

    socket.on('connect', () => {
      logger.debug('[notify] connected.');
      offline.value = false;
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

    socket.on('notification', (msg) => {
      if (!isNotifyMsg(msg)) {
        logger.error('[notify] invalid notification payload', msg);
        return;
      }

      addNotification(msg);
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

  function stop() {
    socket.close();
    isInit = false;
    count.value = 0;
    notifyId.value = 0;
    notifyMsg.value = [];
    friendsStatus.value = new Map();
    offline.value = true;
    chatStore.reset();
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

  function clearAllNotifications() {
    notifyMsg.value = [];
    count.value = 0;
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

      if (data.senderUserId === data.peerUserId)
        addNotification({ title: 'Chat', msg: 'You have a new Chat message.' });
    });
  }

  function sendChatMsg(peerUserId: number, msg: string) {
    socket.emit('chat', { peerUserId, msg });
  }

  function addNotification(msg: NotifyMsg) {
    count.value++;
    const date = new Date(Date.now()).toLocaleString();
    notifyMsg.value.unshift({ id: notifyId.value++, title: msg.title, msg: msg.msg, date });
    toast.info(msg.msg);
  }

  return {
    SYSTEM_SENDER_ID,
    offline,
    friendsStatus,
    count,
    notifyMsg,
    isUserOnline,
    init,
    stop,
    clearAllNotifications,
    sendChatMsg,
  };
});

function isNotifyMsg(value: unknown): value is NotifyMsg {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof (value as Record<string, unknown>).title === 'string' &&
    'msg' in value &&
    typeof (value as Record<string, unknown>).msg === 'string'
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
