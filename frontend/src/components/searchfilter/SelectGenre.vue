<script setup lang="ts">
import { Button } from '../ui/button/index.ts';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu/index.ts';

import { MOVIE_GENRES } from '@/lib/genre';
import { useSearchFilter } from '@/composables/useSearchFilter.ts';

const { selectedGenres, toggleGenre } = useSearchFilter();
</script>

<template>
  <!-- Genre -->
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline">
        Genre
        <span v-if="selectedGenres.length > 0" class="ml-1 text-primary">
          ({{ selectedGenres.length }})
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="max-h-64 overflow-y-auto">
      <DropdownMenuCheckboxItem
        v-for="genre in MOVIE_GENRES"
        :key="genre"
        :model-value="selectedGenres.includes(genre)"
        @update:model-value="(checked: boolean) => toggleGenre(genre, checked)"
        @select.prevent
      >
        {{ genre }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
