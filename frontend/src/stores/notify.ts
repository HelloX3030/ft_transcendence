import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';

export const notifyStore = defineStore('notify', () => {
  const count = ref<number>(0);
  const notifyMsg = ref<string[]>([]);
  const socket = io('http://localhost:3000/notify', { withCredentials: true }); // todo global url

  function init() {
    socket.on('connect', () => {
      console.log('Verbunden:', socket.id);
    });

    socket.on('message', (msg) => {
      count.value++;
      console.log(msg, count.value);
    });
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

  return { count, init };
});
