<script setup lang="ts">
import { Button } from '../ui/button/index.ts';
import { ArrowDown, ArrowUp } from '@lucide/vue';
import { useSearchFilter } from '@/composables/useSearchFilter.ts';

const { sortDirection } = useSearchFilter();
</script>

<template>
  <Button
    variant="outline"
    size="icon"
    @click="sortDirection = sortDirection === 'desc' ? 'asc' : 'desc'"
  >
    <ArrowDown v-if="sortDirection === 'desc'" class="size-4" />
    <ArrowUp v-else class="size-4" />
  </Button>
</template>
