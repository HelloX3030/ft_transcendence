import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';
import type { FriendsStatus, NotifyMsg } from '@trailertinder/shared';
import { BACKEND_URL } from '@/lib/constants';
import { toast } from 'vue-sonner';

export const notifyStore = defineStore('notify', () => {
  let isInit: boolean = false;
  const count = ref<number>(0);
  const nofiyId = ref<number>(0);
  const notifyMsg = ref<{ id: number; titel: string; msg: string; date: string }[]>([]);
  const friendsStatus = ref(new Map<number, boolean>());
  const socket = io(BACKEND_URL + '/notify', { withCredentials: true, autoConnect: false });

  function init() {
    if (isInit) return;
    console.log('[notify] init...');
    socket.connect();

    socket.removeAllListeners();
    socket.on('connect', () => {
      console.log('[notify] connected.');
    });

    socket.on('connect_error', (error) => {
      console.error('[notify] connect error:', error.message);
    });

    socket.on('error', (error) => {
      console.error('[notify] ' + error);
    });

    socket.on('notification', (msg) => {
      if (!isNotifyMsg(msg)) {
        console.error('[notify] invalid notification payload', msg);
        return;
      }

      count.value++;
      const date = new Date(Date.now()).toLocaleString();
      notifyMsg.value.unshift({ id: nofiyId.value++, titel: msg.titel, msg: msg.msg, date });
      toast.info(msg.msg);
    });

    watchFriendsOnlineStatus();
    isInit = true;
  }

  function stop() {
    console.log('[notify] stop.');
    socket.close();
    isInit = false;
  }

  function watchFriendsOnlineStatus() {
    socket.off('watch-friends-status');
    socket.on('watch-friends-status', (data) => {
      if (!isFriendsStatusArray(data)) {
        console.error('[notify] invalid friends status payload', data);
        return;
      }
      for (const user of data) {
        socket.off(`online-status:${user.id}`);
        socket.on(`online-status:${user.id}`, (user) => {
          console.log(user);
          friendsStatus.value.set(user.id, user.isOnline);
        });
        friendsStatus.value.set(user.id, user.isOnline);
        console.log('add watch user Id: ' + user.id);
      }
    });
    socket.on('watch-friends-status-rm', (data) => {
      if (!isFriendsStatusArray(data)) {
        console.error('[notify] invalid friends status payload', data);
        return;
      }
      for (const user of data) {
        socket.off(`online-status:${user.id}`);
        console.log('removed watch user Id: ' + user.id);
        friendsStatus.value.delete(user.id);
      }
    });
    socket.emit('watch-friends-status');
  }

  function clearAllNotifications() {
    notifyMsg.value = [];
    count.value = 0;
  }

  return { count, notifyMsg, init, stop, clearAllNotifications };
});

function isNotifyMsg(value: unknown): value is NotifyMsg {
  return (
    typeof value === 'object' &&
    value !== null &&
    'titel' in value &&
    typeof (value as Record<string, unknown>).titel === 'string' &&
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
