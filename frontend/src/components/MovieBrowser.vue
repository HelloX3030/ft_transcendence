<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import MovieCard from './MovieCard.vue';
import ErrorState from './ErrorState.vue';
import EmptyState from './EmptyState.vue';
import { Spinner } from '@/components/ui/spinner';
import { useMoviesStore } from '@/stores/movies';
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
const sectionLabel = computed(() =>
  isSearching.value ? `${resultCount.value} Results` : 'Popular',
);

// Skeletons only when there is nothing to show yet; a spinner when extending
// an existing list (pagination).
const showSkeletons = computed(
  () => displayStatus.value === 'loading' && displayMovies.value.length === 0,
);
const isPaginating = computed(
  () => displayStatus.value === 'loading' && displayMovies.value.length > 0,
);
const noResults = computed(
  () => isSearching.value && searchStatus.value === 'ready' && searchResults.value.length === 0,
);
const reachedEnd = computed(
  () => isSearching.value && !searchHasMore.value && searchResults.value.length > 0,
);

const SKELETON_COUNT = 12;

// Infinite scroll: when the sentinel scrolls into view during an active search,
// pull the next page.
const loadMoreTrigger = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  store.loadPopular();
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && isSearching.value) {
      void store.loadMore();
    }
  });
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
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
      </template>
    </div>

    <div v-if="isPaginating" class="flex justify-center">
      <Spinner class="size-4" />
    </div>

    <ErrorState
      v-if="displayStatus === 'error'"
      :message="displayMovies.length ? 'Couldn’t load more results.' : 'Something went wrong.'"
      @retry="store.refresh()"
    />
    <EmptyState v-else-if="noResults" message="No results found." />
    <p v-else-if="reachedEnd" class="text-center text-sm text-muted-foreground">No more results.</p>

    <div ref="loadMoreTrigger" class="h-1 w-full" aria-hidden="true"></div>
  </div>
</template>
