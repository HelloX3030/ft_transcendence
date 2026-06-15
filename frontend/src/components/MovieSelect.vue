<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import MovieCard from './MovieCard.vue';
import { useMovies } from '@/composables/useMovies.ts';
import { useMoviesStore } from '@/stores/movies';

const store = useMoviesStore();
const { popular, popularStatus, searchResults, searchStatus } = storeToRefs(store);
const { selectedMovies, addMovie } = useMovies();

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
      :selected="selectedMovies.some((item) => item.id === movie.id)"
      @select="addMovie({ ...movie })"
      :loading="isLoading"
    />
  </div>
</template>
