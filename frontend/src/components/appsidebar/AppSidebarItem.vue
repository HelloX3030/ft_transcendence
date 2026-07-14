<script lang="ts" setup>
import type { LucideIcon } from 'lucide-vue-next';
import { SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar';

interface PropsType {
  titel: string;
  path: string;
  icon?: LucideIcon;
}

defineProps<PropsType>();
</script>

<template>
  <SidebarMenuItem>
    <SidebarMenuButton as-child>
      <RouterLink :to="path" active-class="border-r-2 border-primary rounded-r-xs">
        <icon />
        {{ titel }}
      </RouterLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
</template>
