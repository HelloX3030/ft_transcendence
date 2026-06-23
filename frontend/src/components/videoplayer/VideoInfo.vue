<!-- src/components/videoPlayer/VideoInfo.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { MOVIE_GENRES } from '../../lib/genre';
import type { Provider } from '@/lib/test.ts';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PropsType {
  title: string;
  genreIds: number[];
  providers: Provider[];
  releaseDate: string;
  showGenres?: boolean;
}
const props = defineProps<PropsType>();

const releaseYear = computed(() => new Date(props.releaseDate).getFullYear());

const genreNames = computed(() =>
  props.genreIds
    .map((id) => MOVIE_GENRES[id])
    .filter(Boolean)
    .slice(0, 3),
);
</script>

<template>
  <div class="absolute top-0 left-0 right-0 z-20">
    <div class="relative p-6">
      <div v-if="showGenres" class="flex gap-2 mb-2 pointer-events-none">
        <span
          v-for="genre in genreNames"
          :key="genre"
          class="text-xs text-white border border-white/50 rounded-full px-2 py-0.5"
        >
          {{ genre }}
        </span>
      </div>

      <h2 class="text-white md:text-2xl font-bold drop-shadow-lg pointer-events-none">
        {{ title }}
      </h2>

      <div class="flex items-center gap-2 mt-1 flex-wrap">
        <span class="text-white/70 text-sm pointer-events-none">{{ releaseYear }}</span>

        <template v-if="providers.length">
          <span class="text-white/40 pointer-events-none">·</span>
          <TooltipProvider v-for="provider in providers" :key="provider.name">
            <Tooltip>
              <TooltipTrigger>
                <img
                  :src="`https://image.tmdb.org/t/p/w45${provider.logoPath}`"
                  :alt="provider.name"
                  class="w-8 h-8 rounded-md"
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p class="text-sm tracking-wide">{{ provider.name }}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>
      </div>
    </div>
  </div>
</template>
