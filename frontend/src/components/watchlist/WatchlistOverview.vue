<!-- WatchlistRow.vue -->
<script setup lang="ts">
import { Pencil, ChevronRight } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import type { WatchlistMovieResponse, WatchlistResponse } from '@trailertinder/shared/index.ts';
import { useWatchlist } from '@/composables/useWatchlist.ts';
import { useRouter } from 'vue-router';

const props = defineProps<WatchlistResponse>();

const { getMovieIdsFromWatchlist } = useWatchlist();
const router = useRouter();

const movies = ref<WatchlistMovieResponse[]>([]);

onMounted(async () => {
  movies.value = (await getMovieIdsFromWatchlist(props.id)) ?? [];
});

const posters = computed(() => movies.value.slice(0, 3));
const remainingCount = computed(() => Math.max(movies.value.length - 3, 0));

const formattedDate = computed(() => {
  if (!props.createdAt) return '';
  return new Date(props.createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
});

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
        v-for="(slot, idx) in posters"
        :key="idx"
        :style="{ zIndex: posters.length - idx }"
        class="w-12 h-18 sm:w-16 sm:h-24 lg:w-20 lg:h-30 xl:w-24 xl:h-36 -mr-4 sm:-mr-5 lg:-mr-6 xl:-mr-8 last:mr-0 overflow-hidden rounded-md filter-[drop-shadow(6px_2px_6px_rgba(0,0,0,0.55))] shrink-0"
      >
        <img
          v-if="slot.img ?? true"
          :src="`https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg`"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-popover" />
      </div>
      <div
        v-if="remainingCount > 0"
        class="w-12 h-18 sm:w-16 sm:h-24 lg:w-20 lg:h-30 xl:w-24 xl:h-36 rounded-md border bg-popover flex items-center justify-center text-xs text-muted-foreground shrink-0"
      >
        +{{ remainingCount }}
      </div>
    </div>

    <div class="flex-1 min-w-0">
      <p class="font-medium text-foreground truncate text-sm sm:text-base">{{ name }}</p>
      <p class="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
        {{ movies.length }} {{ movies.length === 1 ? 'Movie' : 'Movies' }}
        <span v-if="formattedDate" class="hidden sm:inline"> · created at {{ formattedDate }}</span>
      </p>
    </div>

    <Button variant="ghost" size="icon" class="shrink-0" @click.stop="$emit('edit', id)">
      <Pencil class="size-4" />
    </Button>
    <ChevronRight class="size-4 text-muted-foreground shrink-0" />
  </div>
</template>
