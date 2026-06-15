<script setup lang="ts">
import MovieSearch from '@/components/MovieSearch.vue';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieCard from '@/components/MovieCard.vue';
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <MovieSearch />

    <MovieBrowser>
      <template #movie="{ movie }">
        <MovieCard :title="movie.title" :img="movie.poster_path" />
      </template>
    </MovieBrowser>
  </div>
</template>
