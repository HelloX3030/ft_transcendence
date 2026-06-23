<script lang="ts" setup>
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
</script>

<template>
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" as-child>
          <RouterLink to="/profile" active-class="border-r-2 border-primary">
            <Avatar>
              <AvatarImage v-if="auth.user?.image" :src="auth.user.image" alt="avatar" />
              <AvatarFallback>{{
                auth.user?.username?.slice(0, 2).toUpperCase() ?? '?'
              }}</AvatarFallback>
            </Avatar>

            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ auth.user?.username ?? '...' }}</span>
            </div>
          </RouterLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>
</template>
