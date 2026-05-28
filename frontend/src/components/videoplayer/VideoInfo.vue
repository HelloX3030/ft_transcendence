<!-- src/components/videoPlayer/VideoInfo.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { MOVIE_GENRES } from '../../lib/genre';

interface PropsType {
  title: string;
  genreIds: number[];
  providers: string[];
  releaseDate: string;
}

const releaseYear = computed(() => new Date(props.releaseDate).getFullYear());

const props = defineProps<PropsType>();

const genreNames = computed(() =>
  props.genreIds
    .map((id) => MOVIE_GENRES[id])
    .filter(Boolean)
    .slice(0, 3),
);
</script>

<template>
  <div class="absolute top-0 left-0 right-0 z-20 pointer-events-none">
    <div class="relative p-6">
      <div class="flex gap-2 mb-2">
        <span
          v-for="genre in genreNames"
          :key="genre"
          class="text-xs text-white border border-white/50 rounded-full px-2 py-0.5"
        >
          {{ genre }}
        </span>
      </div>

      <h2 class="text-white md:text-2xl font-bold drop-shadow-lg">
        {{ title }}
      </h2>
      <div class="flex items-center gap-2 mt-1 flex-wrap">
        <span class="text-white/70 text-sm">{{ releaseYear }}</span>

        <template v-if="providers.length">
          <span class="text-white/40">·</span>
          <span v-for="provider in providers" :key="provider" class="text-xs text-white/70">
            {{ provider }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

//description, Genre, Streaming Anbieter, Erscheinungsjahr //anzeigen wenn drueber hovern oder
start/stopp //bei fullscreen ausblenden
