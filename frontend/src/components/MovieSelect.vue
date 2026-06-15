<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import MovieCard from './MovieCard.vue';
import { useMoviesStore } from '@/stores/movies';
import { useSelectionStore } from '@/stores/selection';

const store = useMoviesStore();
const { popular, popularStatus, searchResults, searchStatus } = storeToRefs(store);

const selection = useSelectionStore();

const movies = computed(() => [...searchResults.value, ...popular.value]);
const isLoading = computed(
  () => popularStatus.value === 'loading' || searchStatus.value === 'loading',
);

onMounted(store.loadPopular);
</script>

<template>
  <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
    <MovieCard
      v-for="movie in movies"
      :key="movie.id"
      :title="movie.title"
      :img="movie.poster_path"
      :selected="selection.isSelected(movie.id)"
      @select="selection.toggleMovie(movie)"
      :loading="isLoading"
    />
  </div>
</template>
