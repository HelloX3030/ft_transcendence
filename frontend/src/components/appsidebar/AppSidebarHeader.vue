<script lang="ts" setup>
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar';
import { RouterLink } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { fileUrl } from '@/lib/files';

const userStore = useUserStore();

const { state: user } = storeToRefs(userStore);
</script>

<template>
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" as-child>
          <RouterLink to="/profile" active-class="border-r-2 border-primary rounded-r-xs">
            <Avatar>
              <AvatarImage
                v-if="user?.avatarFileId"
                :src="fileUrl(user.avatarFileId)"
                alt="avatar"
              />
              <AvatarFallback>{{
                user?.username?.slice(0, 2).toUpperCase() ?? '?'
              }}</AvatarFallback>
            </Avatar>

            <div class="flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ user?.username ?? '...' }}</span>
            </div>
          </RouterLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>
</template>
