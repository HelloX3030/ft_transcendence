<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { severalMovies } from '@/lib/test';
import { useWatchProviders } from '@/composables/useWatchProviders';

import TrailerModal from '@/components/moviedetails/TrailerModal.vue';
import MovieHero from '@/components/moviedetails/MovieHero.vue';
import MovieHeader from '@/components/moviedetails/MovieHeader.vue';
import MovieProviders from '@/components/moviedetails/MovieProviders.vue';
import SimilarMovies from '@/components/moviedetails/SimilarMovies.vue';
import MovieCredits from '@/components/moviedetails/MovieCredits.vue';
import MovieOverview from '@/components/moviedetails/MovieOverview.vue';
import MovieActionBar from '@/components/moviedetails/MovieActionBar.vue';

const route = useRoute();

const showTrailer = ref(false);

const movie = computed(() => severalMovies.find((m) => m.id === Number(route.params.id)));
const similarMovies = computed(() => severalMovies.filter((m) => m.id !== movie.value?.id));
const director = 'Unkown';
const topCast = computed(() => movie.value?.credits.cast.slice(0, 3) ?? []);
const releaseYear = computed(() => movie.value?.release_date.slice(0, 4) ?? '');
const formattedRuntime = computed(() => {
  const mins = movie.value?.runtime;
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
});
const rating = computed(() => movie.value?.vote_average.toFixed(1) ?? '');

const movieId = computed(() => Number(route.params.id));
const { providers } = useWatchProviders(movieId);
const backdropUrl = computed(() => `https://image.tmdb.org/t/p/w1280${movie.value?.backdrop_path}`);
const posterUrl = computed(() => `https://image.tmdb.org/t/p/w342${movie.value?.poster_path}`);
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Fallback -->
    <div v-if="!movie" class="flex items-center justify-center min-h-screen">
      <p class="text-zinc-500">Movie not found.</p>
    </div>

    <div v-else>
      <!-- Hero: Backdrop -->
      <MovieHero :backdropUrl="backdropUrl" :title="movie.title" />

      <!-- Content wrapper mit max-width -->
      <div class="max-w-2xl mx-auto">
        <!-- Poster + Titel -->
        <MovieHeader
          :posterUrl="posterUrl"
          :title="movie.title"
          :tagline="movie.tagline"
          :releaseYear="releaseYear"
          :runtime="formattedRuntime"
          :rating="rating"
          :voteCount="movie.vote_count"
        />

        <!-- Genres -->
        <div class="flex flex-wrap gap-2 px-6 mt-6">
          <span
            v-for="genre in movie.genres"
            :key="genre.id"
            class="px-3 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
          >
            {{ genre.name }}
          </span>
        </div>
        <MovieOverview :overview="movie.overview" />
        <MovieCredits :director="director" :cast="topCast" />
        <MovieProviders v-if="providers.length" :providers="providers" />
        <SimilarMovies :movies="similarMovies" />
      </div>

      <MovieActionBar @trailer="showTrailer = true" />

      <TrailerModal
        v-if="showTrailer"
        :movie="movie"
        :providers="[]"
        @close="showTrailer = false"
      />
    </div>
  </div>
</template>
