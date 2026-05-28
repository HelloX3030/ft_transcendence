<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Header from './components/Header.vue';
import AppSidebar from './components/appsidebar/AppSidebar.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
onMounted(() => auth.init());
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
