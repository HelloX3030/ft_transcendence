<script setup lang="ts">
import type { WatchProvider } from '@trailertinder/shared';

defineProps<{
  providers: WatchProvider[];
}>();
</script>

<template>
  <div class="px-6 mt-8">
    <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Available on</p>
    <div class="flex gap-4">
      <div
        v-for="provider in providers"
        :key="provider.provider_id"
        class="flex flex-col items-center gap-2"
      >
        <img
          :src="`https://image.tmdb.org/t/p/w92${provider.logo_path}`"
          :alt="provider.provider_name"
          class="w-12 h-12 rounded-xl object-cover"
        />
        <p class="text-xs text-zinc-400">{{ provider.provider_name }}</p>
      </div>
    </div>
  </div>
</template>
