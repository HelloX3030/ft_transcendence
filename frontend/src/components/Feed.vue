<script setup lang="ts">
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import VideoPlayer from './videoplayer/VideoPlayer.vue';
import ErrorState from './ErrorState.vue';
import EmptyState from './EmptyState.vue';
import { Spinner } from '@/components/ui/spinner';
import { Clapperboard } from '@lucide/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { watchOnce } from '@vueuse/core';
import { useGlobalVideoPlayer } from '@/composables/useVideoPlayer';
import { useWatchProviders } from '@/composables/useWatchProviders';
import { useDelayedLoading } from '@/composables/useDelayedLoading';
import { useFeedStore } from '@/stores/feed';

const { isFullscreen } = useGlobalVideoPlayer();

const feed = useFeedStore();
const { cards, status, exhausted } = storeToRefs(feed);

// Kept in the store, so navigating away and back does not refetch.
onMounted(() => {
  if (status.value === 'idle') void feed.load();
});

const showLoading = useDelayedLoading(computed(() => status.value === 'loading'));

const currentIndex = ref(0);
const api = ref<CarouselApi>();
const setApi = (val: CarouselApi) => {
  api.value = val;
};

// One TMDB call per card actually watched, rather than per card loaded — which
// is why the feed payload carries no providers.
const activeTmdbId = computed(() => cards.value[currentIndex.value]?.tmdbId);
const { providers } = useWatchProviders(activeTmdbId);

watchOnce(api, (api) => {
  if (!api) return;

  currentIndex.value = api.selectedScrollSnap();
  api.on('select', () => {
    currentIndex.value = api.selectedScrollSnap();
  });
});

// Fires on the last card, not one earlier: with no pagination a refetch is a
// full recommender round-trip plus enrichment, and prefetching would pay it for
// everyone who merely scrolls to the end to see what is there.
watch(currentIndex, (index) => {
  if (index === cards.value.length - 1 && !exhausted.value) void feed.loadMore();
});

watch(isFullscreen, (fullscreen) => {
  if (fullscreen) {
    api.value?.reInit({ watchDrag: false });
  } else {
    api.value?.reInit({ watchDrag: true });
  }
});
</script>

<template>
  <div v-if="showLoading && cards.length === 0" class="h-full flex items-center justify-center">
    <Spinner class="size-8" />
  </div>

  <div
    v-else-if="status === 'error' && cards.length === 0"
    class="h-full flex items-center justify-center"
  >
    <ErrorState message="Couldn't load your feed." @retry="feed.load()" />
  </div>

  <div
    v-else-if="status === 'ready' && cards.length === 0"
    class="h-full flex items-center justify-center"
  >
    <EmptyState message="No trailers to show right now." :icon="Clapperboard" />
  </div>

  <Carousel
    v-else
    orientation="vertical"
    class="w-full h-full border-0 outline-0"
    @init-api="setApi"
  >
    <CarouselContent class="h-full">
      <CarouselItem v-for="(card, index) in cards" :key="card.tmdbId" class="h-full">
        <VideoPlayer
          :tmdb-id="card.tmdbId"
          :title="card.title"
          :video-id="card.trailerKey"
          :active="currentIndex === index"
          :genre-ids="card.genreIds"
          :release-date="card.releaseDate"
          :providers="currentIndex === index ? providers : []"
          :show-genres="true"
        />
      </CarouselItem>

      <!-- Both outcomes of reaching the end are normal, so each gets its own
           slide rather than leaving the user on a card that stopped responding. -->
      <CarouselItem v-if="exhausted" key="end-of-feed" class="h-full">
        <div class="h-full flex flex-col items-center justify-center">
          <EmptyState message="That's everything for now." :icon="Clapperboard" />
          <p class="text-sm text-muted-foreground">React to a few trailers and we'll find more.</p>
        </div>
      </CarouselItem>

      <CarouselItem v-else-if="status === 'error'" key="load-more-failed" class="h-full">
        <div class="h-full flex items-center justify-center">
          <ErrorState message="Couldn't load more trailers." @retry="feed.loadMore()" />
        </div>
      </CarouselItem>
    </CarouselContent>
  </Carousel>
</template>
