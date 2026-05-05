import DiscoverView from "@/views/DiscoverView.vue";
import HomeView from "@/views/HomeView.vue";
import ProfileView from "@/views/ProfileView.vue";
import WatchlistView from "@/views/WatchlistView.vue";
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: HomeView,
    },
    {
      path: "/discover",
      component: DiscoverView,
    },
    {
      path: "/profile",
      component: ProfileView,
    },
    {
      path: "/watchlist",
      component: WatchlistView,
    },
  ],
});

export default router;
