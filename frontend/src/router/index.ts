import { useAuth } from '@/composables/useAuth';
import LoginView from '@/views/auth/LoginView.vue';
import OnboardingView from '@/views/auth/OnboardingView.vue';
import SignupView from '@/views/auth/SignupView.vue';
import DiscoverView from '@/views/DiscoverView.vue';
import HomeView from '@/views/HomeView.vue';

import ProfileView from '@/views/ProfileView.vue';
import ListView from '@/views/watchlist/ListView.vue';

import WatchlistView from '@/views/watchlist/WatchlistsView.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: HomeView,
      meta: { requiresAuth: true, title: 'Home' },
    },
    {
      path: '/discover',
      component: DiscoverView,
      meta: { requiresAuth: true, title: 'Discover' },
    },
    {
      path: '/profile',
      component: ProfileView,
      meta: { requiresAuth: true, title: 'Profil' },
    },
    {
      path: '/watchlist',
      meta: { requiresAuth: true, title: 'Watchlist' },
      children: [
        { path: '', component: WatchlistView },
        { path: ':id', component: ListView },
      ],
    },
    {
      path: '/login',
      component: LoginView,
      meta: { guestOnly: true, hideLayout: true, title: 'Login' },
    },
    {
      path: '/signup',
      component: SignupView,
      meta: { guestOnly: true, hideLayout: true, title: 'Sign Up' },
    },
    {
      path: '/onboarding',
      component: OnboardingView,
      meta: { requiresOnboarding: true, hideLayout: true, title: 'Onboarding' },
    },
  ],
});

router.beforeEach((to) => {
  const { isLoggedIn, requiresOnboarding } = useAuth();

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return { path: '/login' };
  }

  if (to.meta.guestOnly && isLoggedIn.value) {
    return { path: '/' };
  }

  if (to.meta.requiresOnboarding && !requiresOnboarding.value) {
    return { path: '/' };
  }
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | CineMates` : 'CineMates'; //TODO: use env for name
});

export default router;
