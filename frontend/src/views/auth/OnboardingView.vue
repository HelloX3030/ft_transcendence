<script setup lang="ts">
import MovieCard from '@/components/MovieCard.vue';
import MovieSearch from '@/components/MovieSearch.vue';
import { Progress } from '@/components/ui/progress';
import { popular } from '@/lib/test';

import { ref } from 'vue';

const selectedMovies = ref<{ title: string; img: string; id: number }[]>([]);
function handleSelect({
  title,
  poster_path,
  id,
}: {
  title: string;
  poster_path: string;
  id: number;
}) {
  const idx = selectedMovies.value.findIndex((item) => item.id === id);
  if (idx !== -1) selectedMovies.value.splice(idx, 1);
  else if (selectedMovies.value.length < 10)
    selectedMovies.value.push({ title, img: poster_path, id });
}
</script>

<template>
  <div class="flex flex-col flex-1 p-8 gap-4">
    <div class="">
      <h1 class="text-4xl">Pick your Top 10</h1>
      <p class="text-muted-foreground">
        We'll use these to find your perfect movie trailers and refine your feed.
      </p>
    </div>
    <MovieSearch />
    <!-- <div class="flex items-center justify-between">
      <span>Selected({{ selectedMovies.length }}/10)</span>
      <Progress :model-value="selectedMovies.length * 10" class="w-1/3" />
    </div> -->
    <!-- <div class="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
      <MovieCard
        v-for="{ title, poster_path, id } in popular"
        :key="id"
        :title="title"
        :img="poster_path"
        :selected="selectedMovies.some((item) => item.id === id)"
        @select="handleSelect({ title, poster_path, id })"
      />
    </div> -->
  </div>
</template>
