<script lang="ts" setup>
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bell } from 'lucide-vue-next';
import Separator from './ui/separator/Separator.vue';
</script>

<template>
  <header class="flex h-14 shrink-0 items-center">
    <div class="grid grid-cols-3 w-full items-center px-2 md:px-9">
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
          <Bell class="size-6" />
        </RouterLink>
      </div>
    </div>
  </header>
  <Separator orientation="horizontal" />
</template>
