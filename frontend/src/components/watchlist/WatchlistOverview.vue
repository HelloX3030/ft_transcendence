<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { WatchlistResponse } from '@trailertinder/shared';

const props = defineProps<WatchlistResponse>();

const posters = computed(() => {
  //TODO: replace length : 4 with constant
  const placeholders = Array.from({ length: 4 - props.posterPaths.length }, () => null);
  return [...props.posterPaths, ...placeholders];
});

const formattedDate = computed(() => {
  if (!props.createdAt) return '';
  return new Date(props.createdAt).toLocaleDateString('de-DE', {
    //TODO: replace 'de-DE'
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
});

const router = useRouter();

function goToWatchlist() {
  router.push(`/watchlist/${props.id}`);
}
</script>

<template>
  <div
    class="flex items-center gap-3 sm:gap-4 py-3 sm:py-4 border-b cursor-pointer hover:bg-accent/50 transition-colors duration-150 -mx-2 px-2 rounded-md"
    @click="goToWatchlist"
  >
    <div class="flex shrink-0">
      <div
        v-for="(movie, idx) in posters"
        :key="idx"
        :style="{ zIndex: posters.length - idx }"
        class="w-12 h-18 sm:w-16 sm:h-24 lg:w-20 lg:h-30 xl:w-24 xl:h-36 -mr-4 sm:-mr-5 lg:-mr-6 xl:-mr-8 last:mr-0 overflow-hidden filter-[drop-shadow(6px_2px_6px_rgba(0,0,0,0.55))] shrink-0"
      >
        <img
          v-if="movie"
          :src="`https://image.tmdb.org/t/p/w500${movie}`"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-popover border" />
      </div>
    </div>

    <div class="flex-1 min-w-0">
      <p class="font-medium text-foreground truncate text-sm sm:text-base">{{ name }}</p>

      <p class="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
        created at {{ formattedDate }}
      </p>
    </div>

    <ChevronRight class="size-4 text-muted-foreground shrink-0" />
  </div>
</template>
