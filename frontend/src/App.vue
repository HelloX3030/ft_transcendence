<script setup lang="ts">
import { useRoute } from 'vue-router';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import 'vue-sonner/style.css';
import { Toaster } from '@/components/ui/sonner';

import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';
const route = useRoute();
</script>

<template>
  <template v-if="!route.meta.hideLayout">
    <SidebarProvider class="p-0">
      <AppSidebar />
      <!-- min-w-0 on both: a flex item's default min-width is auto, its
           min-content size. Without it, content wider than the viewport forces
           the inset wide, and the only flexible sibling left is the sidebar's
           gap spacer. The visible sidebar is position: fixed, so it stays put
           while the gap behind it closes and content slides underneath. Any
           wide content does this — it is not chat-specific. -->
      <SidebarInset class="min-w-0">
        <div class="sticky top-0 z-50 bg-background">
          <Header />
        </div>
        <main class="flex flex-col flex-1 min-w-0">
          <RouterView :key="$route.fullPath" />
        </main>
        <Toaster position="top-center" />
      </SidebarInset>
    </SidebarProvider>
  </template>

  <main class="h-screen" v-else>
    <RouterView />
  </main>
</template>
