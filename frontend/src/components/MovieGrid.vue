<script setup lang="ts">
import type { TmdbMovie } from '@/lib/tmdb.types';

import MovieCard from './MovieCard.vue';

interface Props {
  movies: TmdbMovie[];
  loading?: boolean;
}

defineProps<Props>();

// Placeholder cards shown while the first page loads (nothing to display yet).
const SKELETON_COUNT = 12;
</script>

<template>
  <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
    <template v-if="loading && movies.length === 0">
      <MovieCard
        v-for="n in SKELETON_COUNT"
        :key="`skeleton-${n}`"
        title=""
        :img="null"
        :loading="true"
      />
    </template>
    <template v-else>
      <MovieCard
        v-for="movie in movies"
        :key="movie.id"
        :title="movie.title"
        :img="movie.poster_path"
        :selected="false"
        :loading="false"
      />
    </template>
  </div>
</template>
