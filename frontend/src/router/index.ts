import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';
import LoginView from '@/views/auth/LoginView.vue';
import OnboardingView from '@/views/auth/OnboardingView.vue';
import SignupView from '@/views/auth/SignupView.vue';
import DiscoverView from '@/views/DiscoverView.vue';
import HomeView from '@/views/HomeView.vue';

import ProfileView from '@/views/ProfileView.vue';

import WatchlistView from '@/views/WatchlistView.vue';
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
      component: WatchlistView,
      meta: { requiresAuth: true, title: 'Watchlist' },
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
  const { isLoggedIn, requiresOnboarding } = storeToRefs(useAuthStore());

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return { path: '/login' };
  }

  if (to.meta.requiresAuth && isLoggedIn.value && requiresOnboarding.value) {
    return { path: '/onboarding' };
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
