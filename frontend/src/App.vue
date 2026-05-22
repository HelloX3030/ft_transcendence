<script setup lang="ts">
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';
import { useRoute } from 'vue-router';
const route = useRoute();
</script>

<template>
  <template v-if="true">
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main class="flex flex-col flex-1">
          <RouterView />
        </main>
      </SidebarInset>
    </SidebarProvider>
  </template>

  <!-- <main class="h-screen" v-else>
    <RouterView />
  </main> -->
</template>
