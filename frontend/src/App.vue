<script setup lang="ts">
import { useRoute } from 'vue-router';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';

import { notifyStore } from './stores/notify.ts';
import { onMounted } from 'vue';

const route = useRoute();
const notify = notifyStore();
onMounted(() => {
  notify.init();
});
</script>

<template>
  <template v-if="!route.meta.hideLayout">
    <SidebarProvider class="p-0">
      <h1>{{ notify.count }}</h1>
      <AppSidebar />
      <SidebarInset>
        <div class="sticky top-0 z-50 bg-background">
          <Header />
        </div>
        <main class="flex flex-col flex-1">
          <RouterView :key="$route.fullPath" />
        </main>
      </SidebarInset>
    </SidebarProvider>
  </template>

  <main class="h-screen" v-else>
    <RouterView />
  </main>
</template>
