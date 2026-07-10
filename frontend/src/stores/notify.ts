import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';

export const notifyStore = defineStore('notify', () => {
  const count = ref<number>(0);
  const nofiyId = ref<number>(0);
  const notifyMsg = ref<{ id: number; titel: string; msg: string; date: string }[]>([]);
  const friendsStatus = ref(new Map<number, boolean>());
  let socket = io('http://localhost:3000/notify', { withCredentials: true, autoConnect: false }); // todo global url

  function init() {
    console.log('[notify] init...');
    socket.connect();

    socket.removeAllListeners();
    socket.on('connect', () => {
      console.log('[notify] connected.'); // todo: error msg if no connection
    });

    socket.on('connect_error', (error) => {
      console.error('[notify] connect error:', error.message);
    });

    socket.on('error', (error) => {
      console.error('[notify] ' + error);
    });

    socket.on('message', (msg) => {
      count.value++;
      const date = new Date(Date.now()).toLocaleString('de-DE'); // todo: use the time format of the user location
      notifyMsg.value.unshift({ id: nofiyId.value++, titel: msg.titel, msg: msg.msg, date });
    });

    watchFriendsOnlineStatus();
  }

  function stop() {
    console.log('[notify] stop.');
    socket.close();
  }

  function watchFriendsOnlineStatus() {
    socket.off('watch-friends-status');
    socket.on('watch-friends-status', (data) => {
      const tmp = data as { id: number; isOnline: boolean }[];
      for (const user of tmp) {
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
      const tmp = data as { id: number; isOnline: boolean }[];
      for (const user of tmp) {
        socket.off(`online-status:${user.id}`);
        console.log('removed watch user Id: ' + user.id);
        friendsStatus.value.delete(user.id);
      }
    });
    socket.emit('watch-friends-status', 'init');
  }

  function clearAllNotifications() {
    notifyMsg.value = [];
    count.value = 0;
  }

  //   async function login(payload: LoginPayload) {
  // 	const res = await fetch('/v1/auth/login', {
  // 	  method: 'POST',
  // 	  headers: { 'Content-Type': 'application/json' },
  // 	  body: JSON.stringify(payload),
  // 	});
  // 	if (!res.ok) await throwApiError(res);
  // 	isLoggedIn.value = true;
  // 	await fetchUser();
  //   }

  return { count, notifyMsg, init, stop, clearAllNotifications };
});
