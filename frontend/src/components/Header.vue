<script lang="ts" setup>
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell } from 'lucide-vue-next';
import Separator from './ui/separator/Separator.vue';
import { APP_NAME } from '@/lib/constants';
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2">
    <div class="flex flex-1 justify-between items-center gap-2 px-3">
      <SidebarTrigger />
      <RouterLink to="/">
        <div class="flex items-center">
          <img src="/logo-512x512.png" alt="logo" class="size-12 rounded-full" />

          <p class="text-lg font-medium hover:text-primary transition-colors">{{ APP_NAME }}</p>
        </div>
      </RouterLink>

      <RouterLink
        to="/notifications"
        class="text-sm font-medium hover:text-primary transition-colors"
        active-class="text-primary"
      >
        <Bell />
      </RouterLink>
    </div>
  </header>
  <Separator orientation="horizontal" />
</template>
