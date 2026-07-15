import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useUserStore } from './stores/user.ts';

const youtube = {
  install() {
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
  await auth.init();
  if (auth.isLoggedIn) {
    await userStore.refetchUser();
  }

  app.use(router);
  app.use(youtube);
  app.mount('#app');
})();
