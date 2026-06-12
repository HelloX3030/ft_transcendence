<script setup lang="ts">
import { useRoute } from 'vue-router';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';

const route = useRoute();
</script>

<template>
  <template v-if="!route.meta.hideLayout">
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

  <main class="h-screen" v-else>
    <RouterView />
  </main>
</template>
