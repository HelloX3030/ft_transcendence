<script setup lang="ts">
import { useRoute } from 'vue-router';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';
import 'vue-sonner/style.css';
import { Toaster } from '@/components/ui/sonner';
const route = useRoute();
</script>

<template>
  <template v-if="!route.meta.hideLayout">
    <SidebarProvider class="p-0">
      <AppSidebar />
      <SidebarInset>
        <div class="sticky top-0 z-50 bg-background">
          <Header />
        </div>
        <main class="flex flex-col flex-1">
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
