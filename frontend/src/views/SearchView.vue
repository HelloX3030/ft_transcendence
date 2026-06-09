<script setup lang="ts">
import { computed, onMounted } from 'vue';
import MovieSearch from '@/components/MovieSearch.vue';
import MovieGrid from '@/components/MovieGrid.vue';
import { Spinner } from '@/components/ui/spinner';
import { useFetch } from '@/composables/useFetch';

const { fetchPopular, popularMovies, searchedMovies, isLoading } = useFetch();

onMounted(() => {
  fetchPopular();
});

const displayMovies = computed(() =>
  searchedMovies.value.length > 0 ? searchedMovies.value : popularMovies.value,
);

const sectionLabel = computed(() =>
  searchedMovies.value.length > 0 ? `${searchedMovies.value.length} Results` : 'Popular',
);
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <MovieSearch />

    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">{{ sectionLabel }}</span>
        <Spinner v-if="isLoading === 'loading'" class="size-4" />
      </div>

      <MovieGrid :movies="displayMovies" />
    </div>
  </div>
</template>
