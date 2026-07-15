import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { notifyStore } from './stores/notify.ts';

const youtube = {
  install() {
    if (window.YT?.Player) return;

    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  },
};

(async () => {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  const auth = useAuthStore();
  const userStore = useUserStore();
  const notify = notifyStore();
  await auth.init();
  if (auth.isLoggedIn) {
    await userStore.refetchUser();
    await notify.init();
  }

  app.use(router);
  app.use(youtube);
  app.mount('#app');
})();
