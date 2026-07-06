<script setup lang="ts">
import MovieCard from '@/components/MovieCard.vue';
import Spinner from '@/components/ui/spinner/Spinner.vue';
import { useWatchlist } from '@/composables/useWatchlist';

import WatchlistHeader from '@/components/watchlist/WatchlistHeader.vue';
import { ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const {
  watchlist,
  watchlistLoading,
  watchlistError,
  movies,
  moviesLoading,
  editors,
  editorsLoading,
} = useWatchlist(Number(route.params.id));

const editors2 = ref([
  { id: 1, username: 'philipp', image: 'https://github.com/shadcn.png' },
  {
    id: 2,
    username: 'urbi',
    image: 'https://github.com/leerob.png',
  },
  { id: 3, username: 'XxXMussiePeisterXxX', image: null },
]);
</script>

<template>
  <section class="flex-1 w-5/6 mx-auto py-8">
    <div
      v-if="watchlistLoading || moviesLoading || editorsLoading"
      class="flex items-center justify-center min-h-screen"
    >
      <Spinner class="size-16" />
    </div>

    <div v-else-if="watchlistError" class="flex items-center justify-center min-h-screen">
      <p class="text-zinc-500">Couldn't load watchlist: {{ (watchlistError as Error).message }}</p>
    </div>

    <div class="h-full flex flex-col" v-else-if="watchlist && movies && editors">
      <WatchlistHeader
        v-bind:watchlist="watchlist"
        v-bind:movies="movies"
        :editors="editors2"
        :editors-loading="editorsLoading"
      />

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
