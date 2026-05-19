import DiscoverView from '@/views/DiscoverView.vue';
import HomeView from '@/views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';
import ProfileView from '@/views/ProfileView.vue';
import WatchlistView from '@/views/WatchlistView.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: HomeView,
    },
    {
      path: '/discover',
      component: DiscoverView,
    },
    {
      path: '/profile',
      component: ProfileView,
    },
    {
      path: '/watchlist',
      component: WatchlistView,
    },
    {
      path: '/login',
      component: LoginView,
    },
  ],
});

export default router;
