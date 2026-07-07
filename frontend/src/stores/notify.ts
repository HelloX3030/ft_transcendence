import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';

export const notifyStore = defineStore('notify', () => {
  const count = ref<number>(0);
  const nofiyId = ref<number>(0);
  const notifyMsg = ref<{ id: number; titel: string; msg: string }[]>([]);
  const socket = io('http://localhost:3000/notify', { withCredentials: true }); // todo global url

  function init() {
    console.log('Notify init...');
    socket.removeAllListeners();
    socket.on('connect', () => {
      console.log('Verbunden:', socket.id); // todo: error msg if no connection
    });

    socket.on('message', (msg) => {
      count.value++;
      notifyMsg.value.push({ id: nofiyId.value++, titel: msg.titel, msg: msg.msg });
      console.log(msg, count.value);
    });

    watchFriendsOnlineStatus();
  }

  function watchFriendsOnlineStatus() {
    socket.off('watch-friends-status');
    socket.on('watch-friends-status', (data) => {
      const tmp = data as { id: number; isOnline: boolean }[];
      for (const user of tmp) {
        socket.off(`online-status:${user.id}`);
        socket.on(`online-status:${user.id}`, (msg) => {
          console.log(msg);
        });
        console.log('add watch user Id: ' + user.id);
      }
    });
    socket.on('watch-friends-status-rm', (data) => {
      const tmp = data as { id: number; isOnline: boolean }[];
      for (const user of tmp) {
        socket.off(`online-status:${user.id}`);
        console.log('removed watch user Id: ' + user.id);
      }
    });
    socket.emit('watch-friends-status', 'init');
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

  return { count, notifyMsg, init };
});
