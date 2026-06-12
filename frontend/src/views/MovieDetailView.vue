<!-- src/views/MovieDetailView.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { oneMovie } from '@/lib/test';

const movie = oneMovie;

const topCast = computed(() => movie.credits.cast.slice(0, 3));
const director = 'Aaron Horvath, Michael Jelenic';
const releaseYear = computed(() => movie.release_date.slice(0, 4));
const formattedRuntime = computed(() => {
  const h = Math.floor(movie.runtime / 60);
  const m = movie.runtime % 60;
  return `${h}h ${m}m`;
});
const rating = computed(() => movie.vote_average.toFixed(1));
const providers = computed(() => movie.watchProviders.results.DE?.flatrate ?? []);
const backdropUrl = `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
const posterUrl = `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Hero: Backdrop -->
    <div class="relative w-full h-80">
      <img :src="backdropUrl" :alt="movie.title" class="w-full h-full object-cover object-top" />
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
    </div>

    <!-- Content wrapper mit max-width -->
    <div class="max-w-2xl mx-auto">
      <!-- Poster + Titel -->
      <!-- Poster + Titel -->
      <div class="flex gap-6 px-4 -mt-24 relative z-10">
        <img :src="posterUrl" :alt="movie.title" class="w-36 rounded-xl shadow-2xl flex-shrink-0" />
        <div class="flex flex-col justify-end pb-2">
          <h1 class="text-2xl font-bold leading-tight">{{ movie.title }}</h1>
          <p class="text-sm text-zinc-400 mt-1 italic">{{ movie.tagline }}</p>
          <div class="flex items-center gap-2 text-sm text-zinc-400 mt-2">
            <span>{{ releaseYear }}</span>
            <span>·</span>
            <span>{{ formattedRuntime }}</span>
            <span>·</span>
            <span class="text-yellow-400 font-medium">⭐ {{ rating }}</span>
            <span class="text-zinc-600 text-xs">({{ movie.vote_count.toLocaleString() }})</span>
          </div>
        </div>
      </div>

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

      <!-- Description -->
      <div class="px-6 mt-4">
        <p class="text-sm text-zinc-300 leading-relaxed">{{ movie.overview }}</p>
      </div>

      <!-- Director -->
      <div class="px-6 mt-6">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-1">Director</p>
        <p class="text-sm text-zinc-200">{{ director }}</p>
      </div>

      <!-- Cast -->
      <div class="px-6 mt-6">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Cast</p>
        <div class="flex gap-6">
          <div
            v-for="actor in topCast"
            :key="actor.id"
            class="flex flex-col items-center gap-2 w-24"
          >
            <img
              :src="`https://image.tmdb.org/t/p/w185${actor.profile_path}`"
              :alt="actor.name"
              class="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-700"
            />
            <p
              class="text-xs text-center text-zinc-300 leading-tight font-medium w-full line-clamp-2"
            >
              {{ actor.name }}
            </p>
            <p class="text-xs text-center text-zinc-500 leading-tight w-full line-clamp-2">
              {{ actor.character }}
            </p>
          </div>
        </div>
      </div>

      <!-- Watch Providers -->
      <div class="px-6 mt-6 pb-12">
        <p class="text-xs text-zinc-500 uppercase tracking-wider mb-3">Available on</p>
        <div class="flex gap-4">
          <div
            v-for="provider in providers"
            :key="provider.provider_id"
            class="flex flex-col items-center gap-2"
          >
            <img
              :src="`https://image.tmdb.org/t/p/w92${provider.logo_path}`"
              :alt="provider.provider_name"
              class="w-12 h-12 rounded-xl object-cover"
            />
            <p class="text-xs text-zinc-400">{{ provider.provider_name }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
