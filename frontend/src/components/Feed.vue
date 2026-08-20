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
import { useGlobalVideoPlayer } from '@/composables/useVideoPlayer';
import { useWatchProviders } from '@/composables/useWatchProviders';
import { useDelayedLoading } from '@/composables/useDelayedLoading';
import { useFeedStore } from '@/stores/feed';

const { isFullscreen } = useGlobalVideoPlayer();

/**
 * An explicit height, not h-full: the app shell gives the wrapper `min-h-svh` and
 * no height, so `height: 100%` has nothing to resolve against and falls back to
 * auto. The only element in the subtree with an intrinsic size is then the
 * YouTube iframe, which would size the layout instead of being sized by it.
 */
const FEED_HEIGHT = 'h-[calc(100vh-var(--header-height))]';

const feed = useFeedStore();
const { cards, status, exhausted } = storeToRefs(feed);

// Kept in the store, so navigating away and back does not refetch.
onMounted(() => {
  if (status.value === 'idle') void feed.load();
});

// immediate: the store outlives the component, so a remount can land on a load
// already running, leaving no transition for the watcher to see.
const showLoading = useDelayedLoading(
  computed(() => status.value === 'loading'),
  { immediate: true },
);

// Reaching the end refetches, and that is a recommender round trip plus TMDB
// enrichment for every card. Without a busy marker the feed looks stuck.
const showLoadingMore = useDelayedLoading(
  computed(() => status.value === 'loading' && cards.value.length > 0),
);

const currentIndex = ref(0);
const api = ref<CarouselApi>();
const setApi = (val: CarouselApi) => {
  api.value = val;
};

/**
 * How many cards around the active one keep a mounted player. Every VideoPlayer
 * builds a YouTube iframe on mount and the feed is twenty cards long, so mounting
 * them all is not an option; one either side gives the next card a single dwell to
 * load in, which an embed rarely finishes. Asymmetric because a feed is watched
 * forwards, so the lookahead budget goes where the user is heading.
 */
const PLAYERS_AHEAD = 2;
const PLAYERS_BEHIND = 1;

const isMounted = (index: number) => {
  const offset = index - currentIndex.value;
  return offset >= -PLAYERS_BEHIND && offset <= PLAYERS_AHEAD;
};

// One TMDB call per card actually watched, rather than per card loaded, which is
// why the feed payload carries no providers.
const activeTmdbId = computed(() => cards.value[currentIndex.value]?.tmdbId);
const { providers } = useWatchProviders(activeTmdbId);

// watch, not watchOnce: the carousel is unmounted whenever the feed has no cards
// (first load, logout) and emits a fresh api when it comes back. Wiring only the
// first one would leave currentIndex frozen at 0.
watch(api, (embla) => {
  if (!embla) return;

  currentIndex.value = embla.selectedScrollSnap();
  embla.on('select', () => {
    currentIndex.value = embla.selectedScrollSnap();
  });
});

// Fires on the last card, not one earlier: with no pagination a refetch is a full
// recommender round trip, and prefetching would pay it for everyone who merely
// scrolls to the end.
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
  <!-- One branch for "no cards", so the carousel is never mounted empty: embla
       measures its slides at init, and an empty init would leave it unaware of
       every card that arrived afterwards. -->
  <div v-if="cards.length === 0" :class="[FEED_HEIGHT, 'flex items-center justify-center']">
    <Spinner v-if="showLoading" class="size-8" />
    <ErrorState
      v-else-if="status === 'error'"
      message="Couldn't load your feed."
      @retry="feed.load()"
    />
    <EmptyState
      v-else-if="status === 'ready'"
      message="No trailers to show right now."
      :icon="Clapperboard"
    />
  </div>

  <Carousel
    v-else
    orientation="vertical"
    :class="['w-full border-0 outline-0', FEED_HEIGHT]"
    @init-api="setApi"
  >
    <CarouselContent class="h-full">
      <!-- The slide itself always renders, so embla keeps measuring a full set;
           only the player inside it is windowed. -->
      <CarouselItem v-for="(card, index) in cards" :key="card.tmdbId" class="h-full">
        <VideoPlayer
          v-if="isMounted(index)"
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

    <!-- Pinned to the viewport rather than given a slide of its own: loadMore
         fires while the user is on the last card, so a spinner they would have
         to scroll onto is a spinner they never see. -->
    <div
      v-if="showLoadingMore"
      class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30"
      role="status"
      aria-label="Loading more trailers"
    >
      <Spinner class="size-6" />
    </div>
  </Carousel>
</template>
