import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useNotifyStore } from './stores/notify.ts';
import { useUserStore } from './stores/user.ts';
import { resetPlugin } from './stores/plugins/resetPlugin.ts';

(async () => {
  const app = createApp(App);
  const pinia = createPinia();
  pinia.use(resetPlugin);
  app.use(pinia);

  const auth = useAuthStore();
  const userStore = useUserStore();
  const notify = useNotifyStore();
  await auth.init();
  if (auth.isLoggedIn) {
    await userStore.refetchUser();
    notify.init();
  }

  app.use(router);
  app.mount('#app');
})();
