<script setup lang="ts">
import { useRouter } from 'vue-router';
import MovieSearch from '@/components/MovieSearch.vue';
import MovieBrowser from '@/components/MovieBrowser.vue';
import MovieFilterToggle from '@/components/MovieFilterToggle.vue';
import MovieCard from '@/components/MovieCard.vue';
import SearchFilters from '@/components/searchfilter/SearchFilters.vue';

const router = useRouter();
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <MovieSearch />
    <MovieFilterToggle />
    <SearchFilters />

    <MovieBrowser>
      <template #movie="{ movie }">
        <MovieCard
          :title="movie.title"
          :img="movie.poster_path"
          @select="router.push(`/moviedetail/${movie.id}`)"
        />
      </template>
    </MovieBrowser>
  </div>
</template>
