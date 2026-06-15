<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMoviesStore } from '@/stores/movies';

const store = useMoviesStore();
const { filtered } = storeToRefs(store);
</script>

<template>
  <div class="flex items-center gap-2">
    <Switch
      id="filter-results"
      :model-value="filtered"
      @update:model-value="store.setFiltered($event)"
    />
    <Label for="filter-results" class="text-sm text-muted-foreground">Filtered results</Label>
  </div>
</template>
