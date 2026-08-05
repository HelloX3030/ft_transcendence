<script setup lang="ts">
import MovieCard from '@/components/MovieCard.vue';
import Spinner from '@/components/ui/spinner/Spinner.vue';
import { useWatchlist } from '@/composables/watchlist/useWatchlist';

import WatchlistHeader from '@/components/watchlist/WatchlistHeader.vue';
import { useRoute, useRouter } from 'vue-router';
import { useWatchlistMovies } from '@/composables/watchlist/useWatchlistMovies';

const route = useRoute();
const { state: watchlist, isLoading, error } = useWatchlist(Number(route.params.id));

const { movies, moviesLoading } = useWatchlistMovies(Number(route.params.id));
const router = useRouter();
</script>

<template>
  <!-- max-w: a percentage width alone leaves the page an unbounded wall of
       cards on an ultrawide. -->
  <section class="flex-1 w-5/6 max-w-[1600px] mx-auto py-8">
    <div v-if="isLoading || moviesLoading" class="flex items-center justify-center min-h-screen">
      <Spinner class="size-16" />
    </div>

    <div v-else-if="error" class="flex items-center justify-center min-h-screen">
      <p class="text-zinc-500">Couldn't load watchlist: {{ (error as Error).message }}</p>
    </div>

    <div class="h-full flex flex-col" v-else-if="watchlist && movies">
      <WatchlistHeader :watchlist="watchlist" :movies="movies" />

      <div v-if="movies?.length == 0" class="flex-1 flex items-center justify-center">
        <p class="text-zinc-500">No Movies in Watchlist.</p>
      </div>

      <!-- Matches MovieBrowser's comfortable grid; see the note there for why
           this is intrinsic rather than a breakpoint ladder. -->
      <div class="grid grid-cols-[repeat(auto-fill,minmax(9rem,10rem))] gap-2 justify-center">
        <MovieCard
          v-for="movie in movies"
          :key="movie.tmdbId"
          :title="movie.name"
          :img="movie.posterPath"
          :selected="false"
          @select="router.push(`/moviedetail/${movie.tmdbId}`)"
        />
      </div>
    </div>
  </section>
</template>
