<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import MovieCard from './MovieCard.vue';
import ErrorState from './ErrorState.vue';
import EmptyState from './EmptyState.vue';
import { useMoviesStore } from '@/stores/movies';
import { useDelayedLoading } from '@/composables/useDelayedLoading';
import type { TmdbMovie } from '@cinemates/shared';

const props = withDefaults(
  defineProps<{ showLabel?: boolean; density?: 'comfortable' | 'compact' }>(),
  { showLabel: true, density: 'comfortable' },
);

// Complete literals, never assembled from fragments: Tailwind only emits CSS for
// classes that appear whole in the source.
//
// Both grids are intrinsic (auto-fill) rather than a breakpoint ladder. A fixed
// column count stops changing past `xl` while the container keeps growing, and
// MovieCard's 2:3 ratio turns that width straight into height. The track has a
// bounded maximum rather than 1fr, which would absorb the leftover width until
// there is room for one more column and then snap back, resizing the cards as
// the window is dragged.
const GRIDS = {
  comfortable: 'grid grid-cols-[repeat(auto-fill,minmax(9rem,10rem))] gap-2 justify-center',
  compact: 'grid grid-cols-[repeat(auto-fill,minmax(7rem,8rem))] gap-2 justify-center',
} as const;

const gridClass = computed(() => GRIDS[props.density]);
// The consumer sizes its own cards via the slot; the skeletons are ours, so they
// have to be told, or a compact grid loads with 2xl corners and lands on lg ones.
const skeletonSize = computed(() => (props.density === 'compact' ? 'sm' : 'default'));

// Each movie is rendered by the consumer, so it controls what a card does
// (select during onboarding, open details from search, …).
defineSlots<{ movie(props: { movie: TmdbMovie }): unknown }>();

const store = useMoviesStore();
const {
  discover,
  discoverStatus,
  discoverHasMore,
  searchResults,
  searchHasMore,
  searchStatus,
  isSearching,
  resultCount,
} = storeToRefs(store);

// Show one collection at a time: search results when searching, else discover.
// The view only ever talks to the "active" feed, so infinite scroll, the
// end-of-list footer and retry all work the same regardless of which is shown.
const displayMovies = computed(() => (isSearching.value ? searchResults.value : discover.value));
const displayStatus = computed(() =>
  isSearching.value ? searchStatus.value : discoverStatus.value,
);
const activeHasMore = computed(() =>
  isSearching.value ? searchHasMore.value : discoverHasMore.value,
);
const loadMoreActive = (): Promise<void> =>
  isSearching.value ? store.loadMore() : store.loadMoreDiscover();
// Header shows how many results are currently loaded (the total lives in the
// search box). Discover browsing has no count.
const sectionLabel = computed(() =>
  isSearching.value ? `Showing ${resultCount.value}` : 'Discover',
);

// Delay the loading indicator so fast (cached) responses don't flash a
// skeleton, and hold it briefly once shown so it can't flicker.
const isLoading = computed(() => displayStatus.value === 'loading');
const showLoading = useDelayedLoading(isLoading);

// Skeletons only when there is nothing to show yet; a spinner when extending
// an existing list (pagination).
const showSkeletons = computed(() => showLoading.value && displayMovies.value.length === 0);
const isPaginating = computed(() => showLoading.value && displayMovies.value.length > 0);
// Only "no results" once the search has actually run dry; a fully filtered-out
// first page, with more pages to come, keeps paginating instead.
const noResults = computed(
  () =>
    isSearching.value &&
    searchStatus.value === 'ready' &&
    searchResults.value.length === 0 &&
    !searchHasMore.value,
);
const reachedEnd = computed(() => !activeHasMore.value && displayMovies.value.length > 0);

// Follows the density only to keep the placeholder block roughly a screenful.
// Both grids are intrinsic, so the column count depends on the container.
const SKELETON_COUNT = computed(() => (props.density === 'compact' ? 18 : 12));

// Infinite scroll. The observer only tracks whether the sentinel is in view and
// does not call loadMore itself: IntersectionObserver fires on enter/leave only,
// so a short page that never pushes the sentinel out of view would trigger once.
// A watcher pulls the next page while the sentinel is visible and more exists.
const loadMoreTrigger = ref<HTMLElement | null>(null);
const sentinelVisible = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  // The discover feed lives in the store and survives navigation, so only fetch
  // it the first time: remounting keeps the loaded pages and the scroll position.
  if (discoverStatus.value === 'idle') store.loadDiscover();
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

watch([sentinelVisible, isSearching, activeHasMore, displayStatus], () => {
  if (sentinelVisible.value && activeHasMore.value && displayStatus.value === 'ready') {
    void loadMoreActive();
  }
});

// A failed page load keeps its loaded results, so retry the failed next page
// rather than reloading from page 1; a failed initial load reloads from scratch.
function onRetry() {
  if (displayMovies.value.length > 0) void loadMoreActive();
  else store.refresh();
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="showLabel" class="flex items-center gap-2">
      <span class="text-sm font-medium text-muted-foreground">{{ sectionLabel }}</span>
    </div>

    <div :class="gridClass">
      <template v-if="showSkeletons">
        <MovieCard
          v-for="n in SKELETON_COUNT"
          :key="`skeleton-${n}`"
          title=""
          :img="null"
          :loading="true"
          :size="skeletonSize"
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
            :size="skeletonSize"
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
