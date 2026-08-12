<script lang="ts" setup>
import type { LucideIcon } from '@lucide/vue';
import { SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar';

const ACTIVE_CLASS = 'border-r-2 border-primary rounded-r-xs';

interface PropsType {
  title: string;
  path: string;
  icon?: LucideIcon;
  /** Highlight only on an exact match. Required for "/", which vue-router counts
   *  as active on every route because it prefix-matches all of them. */
  exact?: boolean;
}

defineProps<PropsType>();
</script>

<template>
  <SidebarMenuItem>
    <SidebarMenuButton as-child>
      <RouterLink
        :to="path"
        :active-class="exact ? '' : ACTIVE_CLASS"
        :exact-active-class="exact ? ACTIVE_CLASS : ''"
      >
        <icon />
        {{ title }}
      </RouterLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
</template>
