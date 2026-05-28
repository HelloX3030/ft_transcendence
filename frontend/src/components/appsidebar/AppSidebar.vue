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
import { BookHeart, CircleQuestionMark, Clapperboard, LogOut } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import AppSidebarHeader from './AppSidebarHeader.vue';
import AppSidebarItem from './AppSidebarItem.vue';

const auth = useAuthStore();
const router = useRouter();

async function handleLogout() {
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <Sidebar>
    <AppSidebarHeader />
    <SidebarContent>
      <SidebarGroup>
        <!-- <SidebarGroupLabel>Platform</SidebarGroupLabel> -->
        <SidebarGroupContent>
          <SidebarMenu>
            <AppSidebarItem titel="Discover" path="/discover" :icon="Clapperboard" />

            <AppSidebarItem titel="Watchlist" path="/watchlist" :icon="BookHeart" />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarSeparator />
      <AppSidebarItem titel="Help" path="/help" :icon="CircleQuestionMark" />
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
