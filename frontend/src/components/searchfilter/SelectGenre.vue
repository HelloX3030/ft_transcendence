<script setup lang="ts">
import { Button } from '../ui/button/index.ts';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu/index.ts';

import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useGenresStore } from '@/stores/genres.ts';
import { useSearchFilter } from '@/composables/useSearchFilter.ts';

const { selectedGenres, toggleGenre } = useSearchFilter();

// The genre catalogue (id + name) comes from the shared store, which fetches it
// once from the backend. ensureLoaded is idempotent, so mounting the menu just
// guarantees the list is (being) loaded.
const genresStore = useGenresStore();
const { genres } = storeToRefs(genresStore);
onMounted(genresStore.ensureLoaded);
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
        v-for="genre in genres"
        :key="genre.id"
        :model-value="selectedGenres.includes(genre.id)"
        @update:model-value="(checked: boolean) => toggleGenre(genre.id, checked)"
        @select.prevent
      >
        {{ genre.name }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
