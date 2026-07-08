<script setup lang="ts">
import MovieCard from '@/components/MovieCard.vue';
import Spinner from '@/components/ui/spinner/Spinner.vue';
import { useWatchlist } from '@/composables/watchlist/useWatchlist';

import WatchlistHeader from '@/components/watchlist/WatchlistHeader.vue';
import { useRoute } from 'vue-router';
import { useWatchlistMovies } from '@/composables/watchlist/useWatchlistMovies';

const route = useRoute();
const { watchlist, watchlistLoading, watchlistError, refetchWatchlist } = useWatchlist(
  Number(route.params.id),
);

const { movies, moviesLoading } = useWatchlistMovies(Number(route.params.id));
</script>

<template>
  <section class="flex-1 w-5/6 mx-auto py-8">
    <div
      v-if="watchlistLoading || moviesLoading"
      class="flex items-center justify-center min-h-screen"
    >
      <Spinner class="size-16" />
    </div>

    <div v-else-if="watchlistError" class="flex items-center justify-center min-h-screen">
      <p class="text-zinc-500">Couldn't load watchlist: {{ (watchlistError as Error).message }}</p>
    </div>

    <div class="h-full flex flex-col" v-else-if="watchlist && movies">
      <WatchlistHeader :watchlist="watchlist" :movies="movies" @success="refetchWatchlist" />

      <div v-if="movies?.length == 0" class="flex-1 flex items-center justify-center">
        <p class="text-zinc-500">No Movies in Watchlist.</p>
      </div>

      <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <MovieCard
          v-for="movie in movies"
          :key="movie.tmdbId"
          :title="movie.name"
          :img="movie.posterPath"
          :selected="false"
        />
      </div>
    </div>
  </section>
</template>
