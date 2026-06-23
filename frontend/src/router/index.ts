import { useAuthStore } from '@/stores/auth';
import { APP_NAME } from '@/lib/constants';
import { storeToRefs } from 'pinia';
import LoginView from '@/views/auth/LoginView.vue';
import OnboardingView from '@/views/auth/OnboardingView.vue';
import SignupView from '@/views/auth/SignupView.vue';
import DiscoverView from '@/views/DiscoverView.vue';
import HomeView from '@/views/HomeView.vue';
import MovieDetailView from '@/views/MovieDetailView.vue';

import FriendsView from '@/views/FriendsView.vue';
import ProfileView from '@/views/ProfileView.vue';
import UserProfileView from '@/views/UserProfileView.vue';
import EditProfileView from '@/views/EditProfileView.vue';
import WatchlistView from '@/views/WatchlistView.vue';
import SearchView from '@/views/SearchView.vue';
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
      path: '/search',
      component: SearchView,
      meta: { requiresAuth: true, title: 'Search' },
    },
    {
      path: '/profile',
      component: ProfileView,
      meta: { requiresAuth: true, title: 'Profil' },
    },
    {
      path: '/profile/edit',
      component: EditProfileView,
      meta: { requiresAuth: true, title: 'Edit Profile' },
    },
    {
      path: '/watchlist',
      component: WatchlistView,
      meta: { requiresAuth: true, title: 'Watchlist' },
    },
    {
      path: '/friends',
      component: FriendsView,
      meta: { requiresAuth: true, title: 'Friends' },
    },
    {
      path: '/users/:id',
      component: UserProfileView,
      meta: { requiresAuth: true, title: 'Profile' },
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
    {
      path: '/moviedetail/:id',
      component: MovieDetailView,
      meta: { requiresAuth: true, title: 'Movie Details' },
    },
  ],
});

// router.beforeEach((to) => {
//   const { isLoggedIn, requiresOnboarding } = storeToRefs(useAuthStore());

//   if (to.meta.requiresAuth && !isLoggedIn.value) {
//     return { path: '/login' };
//   }

//   if (to.meta.requiresAuth && isLoggedIn.value && requiresOnboarding.value) {
//     return { path: '/onboarding' };
//   }

//   if (to.meta.guestOnly && isLoggedIn.value) {
//     return { path: '/' };
//   }

//   if (to.meta.requiresOnboarding && !requiresOnboarding.value) {
//     return { path: '/' };
//   }
// });

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | ${APP_NAME}` : APP_NAME;
});

export default router;
