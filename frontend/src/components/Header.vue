<script lang="ts" setup>
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell } from '@lucide/vue';
import Separator from './ui/separator/Separator.vue';
import { useNotifyStore } from '@/stores/notify.ts';

const notify = useNotifyStore();
</script>

<template>
  <header class="flex h-14 shrink-0 items-center">
    <div class="grid grid-cols-3 w-full items-center px-9">
      <!-- Links: Sidebar -->
      <div class="flex justify-start">
        <SidebarTrigger />
      </div>

      <!-- Mitte: Logo -->
      <div class="flex justify-center">
        <RouterLink to="/">
          <p class="text-2xl tracking-tight">
            <span class="font-light text-white">Cine</span
            ><span class="font-bold text-orange-500">mates</span>
          </p>
        </RouterLink>
      </div>

      <!-- Rechts: Bell -->
      <div class="flex justify-end">
        <RouterLink
          to="/notifications"
          class="hover:text-primary transition-colors"
          active-class="text-primary"
        >
          <!-- <div>
            <h1>{{ notify.count }}</h1>
            <Bell class="size-6" />
          </div> -->
          <div class="relative inline-block">
            <Bell class="size-6" />

            <span
              v-if="notify.count > 0"
              class="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-xs font-bold text-white"
            >
              {{ notify.count }}
            </span>
          </div>
        </RouterLink>
      </div>
    </div>
  </header>
  <Separator orientation="horizontal" />
  <div
    v-if="notify.offline"
    class="w-full bg-red-600 text-white text-center py-1 px-2 text-sm font-medium"
  >
    You are offline.
  </div>
</template>
