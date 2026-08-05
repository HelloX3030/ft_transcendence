<script lang="ts" setup>
import UserAvatar from '@/components/UserAvatar.vue';
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar';
import { RouterLink } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';

const userStore = useUserStore();

const { state: user } = storeToRefs(userStore);
</script>

<template>
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" as-child>
          <RouterLink to="/profile" active-class="border-r-2 border-primary rounded-r-xs">
            <UserAvatar :avatar-file-id="user?.avatarFileId" :username="user?.username" />

            <div class="flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ user?.username ?? '...' }}</span>
            </div>
          </RouterLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>
</template>
