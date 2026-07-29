<script setup lang="ts">
import { Button } from '../ui/button/index.ts';
import { X } from '@lucide/vue';
import { Badge } from '../ui/badge/index.ts';

import { useSearchFilter } from '@/composables/useSearchFilter.ts';
import { useGenresStore } from '@/stores/genres.ts';

const { sortField, selectedGenres, removeGenre, clearFilters } = useSearchFilter();

// Chips store genre ids; resolve to display names via the shared catalogue.
const { genreName } = useGenresStore();
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
      v-for="genreId in selectedGenres"
      :key="genreId"
      variant="secondary"
      class="flex items-center gap-2 cursor-pointer"
      @click="removeGenre(genreId)"
    >
      {{ genreName(genreId) }}
      <X />
    </Badge>

    <Button variant="outline" size="sm" @click="clearFilters()"> Clear all </Button>
  </template>
</template>
