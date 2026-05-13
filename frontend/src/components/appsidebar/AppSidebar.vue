<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { BookHeart, CircleQuestionMark, Clapperboard, LogOut } from 'lucide-vue-next';
import AppSidebarHeader from './AppSidebarHeader.vue';
import AppSidebarItem from './AppSidebarItem.vue';
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
      <AppSidebarItem titel="Logout" path="/logout" :icon="LogOut" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
