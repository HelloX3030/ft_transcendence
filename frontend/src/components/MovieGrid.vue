<script setup lang="ts">
import type { TmdbMovie } from '@/lib/tmdb.types';

import MovieCard from './MovieCard.vue';

interface Props {
  movies: TmdbMovie[];
}

defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
    <MovieCard
      v-for="movie in movies"
      :key="movie.id"
      :title="movie.title"
      :img="movie.poster_path ?? ''"
      :selected="false"
      :loading="false"
    />
  </div>
</template>
