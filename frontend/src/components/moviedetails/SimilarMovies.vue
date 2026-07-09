<script setup lang="ts">
import type { TmdbMovie } from '@trailertinder/shared';
import { useRouter } from 'vue-router';

defineProps<{
  movies: TmdbMovie[];
}>();

const router = useRouter();
</script>

<template>
  <div class="mt-8 pb-32">
    <p class="text-xs text-zinc-500 uppercase tracking-wider px-6 mb-3">More like this</p>
    <div class="flex gap-3 overflow-x-auto px-6 pb-2 scrollbar-hide">
      <div
        v-for="movie in movies"
        :key="movie.id"
        class="flex-shrink-0 w-28 cursor-pointer"
        @click="router.push(`/moviedetail/${movie.id}`)"
      >
        <img
          :src="`https://image.tmdb.org/t/p/w185${movie.poster_path}`"
          :alt="movie.title"
          class="w-28 h-40 object-cover rounded-xl"
        />
        <p class="text-xs text-zinc-300 mt-2 line-clamp-2 leading-tight">{{ movie.title }}</p>
        <p class="text-xs text-zinc-500 mt-1">⭐ {{ movie.vote_average.toFixed(1) }}</p>
      </div>
    </div>
  </div>
</template>
