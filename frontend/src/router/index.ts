import { APP_NAME } from '@/lib/constants';
import AuthCallbackView from '@/views/auth/AuthCallbackView.vue';
import ForgotPasswordView from '@/views/auth/ForgotPasswordView.vue';
import LoginView from '@/views/auth/LoginView.vue';
import ResetPasswordView from '@/views/auth/ResetPasswordView.vue';
import OnboardingView from '@/views/auth/OnboardingView.vue';
import SignupView from '@/views/auth/SignupView.vue';
import DiscoverView from '@/views/DiscoverView.vue';
import HomeView from '@/views/HomeView.vue';
import MovieDetailView from '@/views/MovieDetailView.vue';
import TermsView from '@/views/TermsView.vue';
import PrivacyView from '@/views/PrivacyView.vue';

import ChatView from '@/views/ChatView.vue';
import FriendsView from '@/views/FriendsView.vue';
import ProfileView from '@/views/ProfileView.vue';
import UserProfileView from '@/views/UserProfileView.vue';
import EditProfileView from '@/views/EditProfileView.vue';
import { useAuthStore } from '@/stores/auth';
import { storeToRefs } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import WatchlistsView from '@/views/watchlist/WatchlistsView.vue';
import ListView from '@/views/watchlist/ListView.vue';
import { useUserStore } from '@/stores/user';
import NotificationView from '@/views/NotificationView.vue';

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
      meta: { requiresAuth: true, title: 'Profile' },
    },
    {
      path: '/profile/edit',
      component: EditProfileView,
      meta: { requiresAuth: true, title: 'Edit Profile' },
    },
    {
      path: '/watchlist',
      meta: { requiresAuth: true, title: 'Watchlists' },
      children: [
        { path: '', component: WatchlistsView },
        { path: ':id', component: ListView },
      ],
    },
    {
      path: '/friends',
      component: FriendsView,
      meta: { requiresAuth: true, title: 'Friends' },
    },
    {
      path: '/chat',
      component: ChatView,
      meta: { requiresAuth: true, title: 'Chat' },
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
      // Both reset routes are deliberately not guestOnly: a reset link is
      // opened in whatever browser reads the mail, which is usually one the
      // user is already signed into, and guestOnly would drop them on / with
      // no explanation.
      path: '/forgot-password',
      component: ForgotPasswordView,
      meta: { hideLayout: true, title: 'Forgot Password' },
    },
    {
      path: '/reset-password',
      component: ResetPasswordView,
      meta: { hideLayout: true, title: 'Reset Password' },
    },
    {
      // Where the Google callback lands. Deliberately neither requiresAuth nor
      // guestOnly: it has to render before the session is confirmed, and the
      // user arriving here is mid-login, so guestOnly would bounce them away.
      path: '/auth/callback',
      component: AuthCallbackView,
      meta: { hideLayout: true, title: 'Signing in' },
    },
    {
      path: '/onboarding',
      component: OnboardingView,
      meta: { requiresAuth: true, hideLayout: true, title: 'Onboarding' },
    },
    {
      path: '/moviedetail/:id',
      component: MovieDetailView,
      meta: { requiresAuth: true, title: 'Movie Details' },
    },
    {
      path: '/notifications',
      component: NotificationView,
      meta: { requiresAuth: true, title: 'Notifications' },
    },
    {
      path: '/terms',
      component: TermsView,
      meta: { requiresAuth: false, hideLayout: true, title: 'Terms of Service' },
    },
    {
      path: '/privacy',
      component: PrivacyView,
      meta: { requiresAuth: false, hideLayout: true, title: 'Privacy Policy' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  const { isLoggedIn } = storeToRefs(auth);
  const { requiresOnboarding, isReady, isLoading } = storeToRefs(useUserStore());

  if (to.meta.requiresAuth && isLoggedIn.value && !isReady.value) {
    // Still loading. Callers await refetchUser() before navigating, so this is
    // transient — let it through rather than bouncing mid-load.
    if (isLoading.value) return;

    // Settled and still not ready means refetchUser() failed; main.ts swallows
    // that. requiresOnboarding below would be meaningless and the view would
    // render against a null user, so treat the session as unusable. isLoggedIn
    // has to be cleared as well, or /login (guestOnly) bounces straight back.
    auth.isLoggedIn = false;
    return { path: '/login' };
  }

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return { path: '/login' };
  }

  if (
    to.meta.requiresAuth &&
    isLoggedIn.value &&
    requiresOnboarding.value &&
    to.path !== '/onboarding'
  ) {
    return { path: '/onboarding' };
  }

  if (to.path === '/onboarding' && isReady.value && !requiresOnboarding.value) {
    return { path: '/' };
  }

  if (to.meta.guestOnly && isLoggedIn.value) {
    return { path: '/' };
  }

  if (to.meta.requiresOnboarding && !requiresOnboarding.value) {
    return { path: '/' };
  }
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | ${APP_NAME}` : APP_NAME;
});

export default router;
