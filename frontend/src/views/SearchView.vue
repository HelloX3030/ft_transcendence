<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import MovieSearch from '@/components/MovieSearch.vue';
import MovieGrid from '@/components/MovieGrid.vue';
import { Spinner } from '@/components/ui/spinner';
import { useFetch } from '@/composables/useFetch';

const {
  fetchPopular,
  popularMovies,
  searchedMovies,
  searchedHasMore,
  searchQuery,
  loadMoreSearchedMovies,
  isLoading,
} = useFetch();

const isSearching = computed(() => searchQuery.value !== '');

const displayMovies = computed(() =>
  isSearching.value ? searchedMovies.value : popularMovies.value,
);

const sectionLabel = computed(() =>
  isSearching.value ? `${searchedMovies.value.length} Results` : 'Popular',
);

const noResults = computed(
  () => isSearching.value && isLoading.value === 'finish' && searchedMovies.value.length === 0,
);

const reachedEnd = computed(
  () => isSearching.value && !searchedHasMore.value && searchedMovies.value.length > 0,
);

// Infinite scroll: when the sentinel at the bottom of the list scrolls into
// view during an active search, pull the next page.
const loadMoreTrigger = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  fetchPopular();
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting && isSearching.value) {
      void loadMoreSearchedMovies();
    }
  });
  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <MovieSearch />

    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">{{ sectionLabel }}</span>
        <Spinner v-if="isLoading === 'loading'" class="size-4" />
      </div>

      <MovieGrid :movies="displayMovies" />

      <p v-if="noResults" class="text-center text-sm text-muted-foreground">No results found.</p>
      <p v-else-if="reachedEnd" class="text-center text-sm text-muted-foreground">
        No more results.
      </p>

      <div ref="loadMoreTrigger" class="h-1 w-full" aria-hidden="true"></div>
    </div>
  </div>
</template>
