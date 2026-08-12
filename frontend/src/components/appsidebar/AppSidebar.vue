<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  BookHeart,
  Clapperboard,
  FileText,
  Flame,
  LogOut,
  MessageCircle,
  Shield,
  Users,
} from '@lucide/vue';
import { useAuthStore } from '@/stores/auth';
import AppSidebarHeader from './AppSidebarHeader.vue';
import AppSidebarItem from './AppSidebarItem.vue';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();

async function handleLogout() {
  // Navigating is the one thing that has to happen whatever else goes wrong.
  // Behind a bare `await` it does not: a rejection anywhere in logout() skips
  // it and leaves the user sitting on an authenticated route.
  try {
    await auth.logout();
  } finally {
    // replace, not push: the route we came from is dead once the session is gone.
    void router.replace('/login');
  }
}
</script>

<template>
  <Sidebar>
    <AppSidebarHeader />
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <AppSidebarItem title="Feed" path="/" :icon="Flame" exact />
            <AppSidebarItem title="Discover" path="/discover" :icon="Clapperboard" />
            <AppSidebarItem title="Watchlist" path="/watchlist" :icon="BookHeart" />
            <AppSidebarItem title="Friends" path="/friends" :icon="Users" />
            <AppSidebarItem title="Chat" path="/chat" :icon="MessageCircle" />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarSeparator />
      <AppSidebarItem title="Terms of Service" path="/terms" :icon="FileText" />
      <AppSidebarItem title="Privacy Policy" path="/privacy" :icon="Shield" />
      <SidebarMenuItem>
        <SidebarMenuButton @click="handleLogout">
          <LogOut />
          Logout
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
