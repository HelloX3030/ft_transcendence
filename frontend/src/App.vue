<script setup lang="ts">
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';
import MobileFooter from './components/MobileFooter.vue';

import { useMediaQuery } from '@vueuse/core';
const isMobile = useMediaQuery('(max-width: 768px)');
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <Header />
      <main class="flex flex-col flex-1">
        <section class="flex-1">
          <RouterView />
        </section>
        <MobileFooter v-if="isMobile" />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped></style>
