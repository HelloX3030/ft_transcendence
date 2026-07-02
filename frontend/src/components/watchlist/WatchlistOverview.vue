<script setup lang="ts">
import { Pencil, ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';
import type { WatchlistResponse } from '@trailertinder/shared/index.ts';
import { useRouter } from 'vue-router';
import { Button } from '../ui/button';
import Skeleton from '../ui/skeleton/Skeleton.vue';
import { useWatchlist } from '@/composables/useWatchlist.ts';

const props = defineProps<WatchlistResponse>();

const { movieIds, movieIdsLoading } = useWatchlist(props.id);

const posters = computed(() => {
  const real =
    movieIds.value?.slice(0, 3).map((movie) => ({
      ...movie,
      poster_path: '/1E5baAaEse26fej7uHcjOgEE2t2.jpg', //TODO: replace hardcoded poster_path
    })) ?? [];
  const placeholders = Array.from({ length: 3 - real.length }, () => null);
  return [...real, ...placeholders];
});

const remainingCount = computed(() =>
  movieIds.value ? Math.max(movieIds.value.length - 3, 0) : 0,
);

const formattedDate = computed(() => {
  if (!props.createdAt) return '';
  return new Date(props.createdAt).toLocaleDateString('de-DE', {
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
      <template v-if="movieIdsLoading">
        <Skeleton
          class="w-12 h-18 sm:w-16 sm:h-24 lg:w-20 lg:h-30 xl:w-24 xl:h-36 overflow-hidden -mr-4 sm:-mr-5 lg:-mr-6 xl:-mr-8 last:mr-0 shrink-0"
        />
      </template>
      <template v-else>
        <div
          v-for="(movie, idx) in posters"
          :key="idx"
          :style="{ zIndex: posters.length - idx }"
          class="w-12 h-18 sm:w-16 sm:h-24 lg:w-20 lg:h-30 xl:w-24 xl:h-36 -mr-4 sm:-mr-5 lg:-mr-6 xl:-mr-8 last:mr-0 overflow-hidden filter-[drop-shadow(6px_2px_6px_rgba(0,0,0,0.55))] shrink-0"
        >
          <img
            v-if="movie"
            :src="`https://image.tmdb.org/t/p/w500${movie.poster_path}`"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full bg-popover border" />
        </div>
      </template>
      <div
        v-if="!movieIdsLoading && remainingCount > 0"
        class="w-12 h-18 sm:w-16 sm:h-24 lg:w-20 lg:h-30 xl:w-24 xl:h-36 bg-popover border flex items-center justify-center text-xs text-muted-foreground shrink-0"
      >
        +{{ remainingCount }}
      </div>
    </div>

    <div class="flex-1 min-w-0">
      <Skeleton v-if="movieIdsLoading" class="h-4 w-24 mt-1" />
      <p v-else class="font-medium text-foreground truncate text-sm sm:text-base">{{ name }}</p>

      <Skeleton v-if="movieIdsLoading" class="h-4 w-36 mt-1" />
      <p v-else class="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
        {{ movieIds?.length }} {{ movieIds?.length === 1 ? 'Movie' : 'Movies' }}
        <span v-if="formattedDate" class="hidden sm:inline"> · created at {{ formattedDate }}</span>
      </p>
    </div>

    <Button variant="ghost" size="icon" class="shrink-0" @click.stop="$emit('edit', id)">
      <Pencil class="size-4" />
    </Button>
    <ChevronRight class="size-4 text-muted-foreground shrink-0" />
  </div>
</template>
