<script setup lang="ts">
import { Button } from '../ui/button/index.ts';
import { X } from 'lucide-vue-next';
import { Badge } from '../ui/badge/index.ts';

import { useSearchFilter } from '@/composables/useSearchFilter.ts';

const { sortField, selectedGenres, removeGenre, clearFilters } = useSearchFilter();
</script>

<template>
  <Badge
    v-if="sortField !== 'default'"
    variant="secondary"
    class="flex items-center gap-2 cursor-pointer"
    @click="sortField = 'default'"
  >
    Sort: {{ sortField.replace('_', ' ').toUpperCase() }}
    <X />
  </Badge>

  <template v-if="selectedGenres.length > 0">
    <Badge
      v-for="genre in selectedGenres"
      :key="genre"
      variant="secondary"
      class="flex items-center gap-2 cursor-pointer"
      @click="removeGenre(genre)"
    >
      {{ genre }}
      <X />
    </Badge>

    <Button variant="outline" size="sm" @click="clearFilters()"> Clear all </Button>
  </template>
</template>
