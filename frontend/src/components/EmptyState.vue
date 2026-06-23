<script setup lang="ts">
import type { Component } from 'vue';
import { SearchX } from 'lucide-vue-next';

// Informational empty state (no action) — the counterpart to ErrorState, which
// is for retryable failures. Pass an icon to fit the context (search, watchlist…).
withDefaults(defineProps<{ message?: string; icon?: Component }>(), {
  message: 'Nothing here yet.',
});
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-8 text-center">
    <component :is="icon ?? SearchX" class="size-8 text-muted-foreground" />
    <p class="text-sm text-muted-foreground">{{ message }}</p>
  </div>
</template>
