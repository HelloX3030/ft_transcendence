import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useNotifyStore } from './stores/notify.ts';
import { useUserStore } from './stores/user.ts';
import { resetPlugin } from './stores/plugins/resetPlugin.ts';
import { logger } from './lib/logger.ts';
import { toast } from 'vue-sonner';

(async () => {
  const app = createApp(App);
  const pinia = createPinia();
  pinia.use(resetPlugin);
  app.use(pinia);

  // Without these, Vue and vue-router fall back to their own built-in handlers,
  // which print a raw console.error in a shape we never chose and tell the user
  // nothing. Routing both here means an unhandled failure has exactly one
  // outlet, and it is the one the user can see.
  app.config.errorHandler = (error, _instance, info) => {
    logger.debug('[vue] unhandled error', info, error);
    toast.error('Something went wrong.');
  };
  router.onError((error) => {
    logger.debug('[router] navigation failed', error);
    toast.error('That page could not be opened.');
  });

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
