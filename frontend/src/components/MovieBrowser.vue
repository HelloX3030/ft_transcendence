<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import MovieCard from './MovieCard.vue';
import ErrorState from './ErrorState.vue';
import EmptyState from './EmptyState.vue';
import { useMoviesStore } from '@/stores/movies';
import { useDelayedLoading } from '@/composables/useDelayedLoading';
import type { TmdbMovie } from '@/lib/tmdb.types';

withDefaults(defineProps<{ showLabel?: boolean }>(), { showLabel: true });

// Each movie is rendered by the consumer, so it controls what a card does
// (select during onboarding, open details from search, …).
defineSlots<{ movie(props: { movie: TmdbMovie }): unknown }>();

const store = useMoviesStore();
const {
  popular,
  popularStatus,
  searchResults,
  searchHasMore,
  searchStatus,
  isSearching,
  resultCount,
} = storeToRefs(store);

// Show one collection at a time: search results when searching, else popular.
const displayMovies = computed(() => (isSearching.value ? searchResults.value : popular.value));
const displayStatus = computed(() =>
  isSearching.value ? searchStatus.value : popularStatus.value,
);
// Header shows how many results are currently loaded (the total lives in the
// search box). Popular browsing has no count.
const sectionLabel = computed(() =>
  isSearching.value ? `Showing ${resultCount.value}` : 'Popular',
);

// Delay the loading indicator so fast (cached) responses don't flash a
// skeleton, and hold it briefly once shown so it can't flicker.
const isLoading = computed(() => displayStatus.value === 'loading');
const showLoading = useDelayedLoading(isLoading);

// Skeletons only when there is nothing to show yet; a spinner when extending
// an existing list (pagination).
const showSkeletons = computed(() => showLoading.value && displayMovies.value.length === 0);
const isPaginating = computed(() => showLoading.value && displayMovies.value.length > 0);
const noResults = computed(
  () => isSearching.value && searchStatus.value === 'ready' && searchResults.value.length === 0,
);
const reachedEnd = computed(
  () => isSearching.value && !searchHasMore.value && searchResults.value.length > 0,
);

const SKELETON_COUNT = 12;

// Infinite scroll. The observer only tracks whether the sentinel is in view;
// it does NOT call loadMore directly, because IntersectionObserver fires on
// enter/leave only — a short result page that never pushes the sentinel out of
// view would trigger just once. Instead a watcher pulls the next page whenever
// the sentinel is visible and more exists, re-running as results arrive so it
// keeps filling until the viewport is covered.
const loadMoreTrigger = ref<HTMLElement | null>(null);
const sentinelVisible = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  store.loadPopular();
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries[0]?.isIntersecting ?? false;
    },
    { rootMargin: '200px' },
  );
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

watch([sentinelVisible, isSearching, searchHasMore, searchStatus], () => {
  if (
    sentinelVisible.value &&
    isSearching.value &&
    searchHasMore.value &&
    searchStatus.value === 'ready'
  ) {
    void store.loadMore();
  }
});

// A failed page load keeps its loaded results, so retry the failed next page
// (append) rather than reloading from page 1; a failed initial load has nothing
// to preserve, so reload from scratch.
function onRetry() {
  if (isSearching.value && displayMovies.value.length > 0) void store.loadMore();
  else store.refresh();
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="showLabel" class="flex items-center gap-2">
      <span class="text-sm font-medium text-muted-foreground">{{ sectionLabel }}</span>
    </div>

    <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <template v-if="showSkeletons">
        <MovieCard
          v-for="n in SKELETON_COUNT"
          :key="`skeleton-${n}`"
          title=""
          :img="null"
          :loading="true"
        />
      </template>
      <template v-else>
        <template v-for="movie in displayMovies" :key="movie.id">
          <slot name="movie" :movie="movie" />
        </template>
        <!-- Placeholder cards for the page being fetched (infinite scroll). -->
        <template v-if="isPaginating">
          <MovieCard
            v-for="n in SKELETON_COUNT"
            :key="`page-skeleton-${n}`"
            title=""
            :img="null"
            :loading="true"
          />
        </template>
      </template>
    </div>

    <ErrorState
      v-if="displayStatus === 'error'"
      :message="displayMovies.length ? 'Couldn’t load more results.' : 'Something went wrong.'"
      @retry="onRetry()"
    />
    <EmptyState v-else-if="noResults" message="No results found." />
    <p v-else-if="reachedEnd" class="text-center text-sm text-muted-foreground">No more results.</p>

    <div ref="loadMoreTrigger" class="h-1 w-full" aria-hidden="true"></div>
  </div>
</template>
