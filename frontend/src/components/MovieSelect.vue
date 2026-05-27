<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useFetch } from '@/composables/useFetch.ts';
import MovieCard from './MovieCard.vue';
import { useMovies } from '@/composables/useMovies.ts';

const { fetchPopular, popularMovies, searchedMovies, isLoading } = useFetch();
const { selectedMovies, addMovie } = useMovies();

const movies = computed(() => [...searchedMovies.value, ...popularMovies.value]);

onMounted(fetchPopular);
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
      :loading="isLoading === 'loading'"
    />
  </div>
</template>
