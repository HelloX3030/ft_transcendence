<script setup lang="ts">
import MovieCard from '@/components/MovieCard.vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Spinner from '@/components/ui/spinner/Spinner.vue';
import { useWatchlist } from '@/composables/useWatchlist';

import { ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
const route = useRoute();

const { watchlist, watchlistLoading, watchlistError, movies, moviesLoading, editors } =
  useWatchlist(Number(route.params.id));

const editors2 = ref([
  { id: 1, username: 'philipp', image: null },
  { id: 2, username: 'urbi', image: null },
]);
</script>

<template>
  <section class="flex-1 w-5/6 mx-auto p-8">
    <div
      v-if="watchlistLoading || moviesLoading"
      class="flex items-center justify-center min-h-screen"
    >
      <Spinner class="size-16" />
    </div>

    <div v-else-if="watchlist && movies && editors">
      <div class="flex flex-col gap-1 mb-8">
        <h1 class="font-bold text-2xl md:text-3xl xl:text-4xl mb-4">{{ watchlist?.name }}</h1>

        <div class="flex flex-wrap items-center gap-2 md:text-xl">
          <span class="text-muted-foreground">List by</span>
          <div class="flex items-center gap-2">
            <template v-for="(user, idx) in editors2" :key="user.id">
              <RouterLink
                :to="`/profile/${user.id}`"
                class="flex items-center gap-1.5 hover:text-primary transition-colors text-muted-foreground"
              >
                <Avatar>
                  <AvatarImage v-if="user.image" :src="user.image" />
                  <AvatarFallback class="bg-secondary">
                    {{ user.username.slice(0, 2).toUpperCase() }}
                  </AvatarFallback>
                </Avatar>
                <span>{{ user.username }}</span>
              </RouterLink>
              <span v-if="idx < editors2.length - 1" class="text-muted-foreground">·</span>
            </template>
          </div>
          <span class="text-muted-foreground hidden sm:inline">·</span>
          <span class="text-muted-foreground">
            {{ new Date(watchlist.createdAt).toLocaleDateString() }}
          </span>
        </div>
      </div>

      <div v-if="movies?.length == 0" class="flex items-center justify-center py-32">
        <p class="text-zinc-500">No Movies in Watchlist.</p>
      </div>

      <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8 my-8">
        <MovieCard
          v-for="movie in movies"
          :key="movie.tmdbId"
          :title="movie.name"
          :img="movie.posterPath"
          :selected="false"
        />
      </div>
    </div>

    <div v-else-if="watchlistError" class="flex items-center justify-center min-h-screen">
      <p class="text-zinc-500">Couldn't load watchlist: {{ (watchlistError as Error).message }}</p>
    </div>
  </section>
</template>
