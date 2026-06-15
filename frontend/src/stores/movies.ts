import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { PaginatedMovies, TmdbMovie } from '@/lib/tmdb.types';

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

// Fetches JSON and throws on HTTP errors — otherwise an error body would be
// parsed as PaginatedMovies and `results: undefined` would crash the views.
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
  return (await res.json()) as T;
}

export const useMoviesStore = defineStore('movies', () => {
  // Popular list — loaded once per visit, shown as the default browse state.
  const popular = ref<TmdbMovie[]>([]);
  const popularStatus = ref<FetchStatus>('idle');

  // Active search session — drives pagination/infinite scroll of the results.
  const searchQuery = ref('');
  const searchResults = ref<TmdbMovie[]>([]);
  const searchPage = ref(1);
  const searchHasMore = ref(false);
  const searchStatus = ref<FetchStatus>('idle');

  const isSearching = computed(() => searchQuery.value !== '');
  const resultCount = computed(() => searchResults.value.length);

  async function loadPopular() {
    try {
      popularStatus.value = 'loading';
      const data = await fetchJson<PaginatedMovies>('/v1/tmdb/popular');
      popular.value = data.results;
      popularStatus.value = 'ready';
    } catch (error) {
      console.error(error);
      popularStatus.value = 'error';
    }
  }

  // Ends the active search session and clears its results — views fall back to
  // the popular list.
  function resetSearch() {
    searchQuery.value = '';
    searchPage.value = 1;
    searchResults.value = [];
    searchHasMore.value = false;
    searchStatus.value = 'idle';
  }

  // Starts a fresh search: resets to page 1 and replaces the previous results.
  // An empty (or whitespace) query clears the search instead — the backend
  // rejects empty queries.
  async function search(input: string) {
    const query = input.trim();
    if (!query) {
      resetSearch();
      return;
    }
    try {
      searchStatus.value = 'loading';
      searchQuery.value = query;
      searchPage.value = 1;
      const data = await fetchJson<PaginatedMovies>(
        `/v1/tmdb/search?query=${encodeURIComponent(query)}&page=1`,
      );
      searchResults.value = data.results;
      searchHasMore.value = data.hasMore;
      searchStatus.value = 'ready';
    } catch (error) {
      console.error(error);
      searchStatus.value = 'error';
    }
  }

  // Retries the current view after a failure: re-runs the active search (from
  // page 1) when searching, otherwise reloads the popular list.
  function refresh() {
    if (isSearching.value) void search(searchQuery.value);
    else void loadPopular();
  }

  // Loads the next page of the current search and appends to the existing results.
  async function loadMore() {
    if (searchStatus.value === 'loading' || !searchQuery.value || !searchHasMore.value) return;
    try {
      searchStatus.value = 'loading';
      const nextPage = searchPage.value + 1;
      const data = await fetchJson<PaginatedMovies>(
        `/v1/tmdb/search?query=${encodeURIComponent(searchQuery.value)}&page=${nextPage}`,
      );
      searchPage.value = nextPage;
      searchResults.value = [...searchResults.value, ...data.results];
      searchHasMore.value = data.hasMore;
      searchStatus.value = 'ready';
    } catch (error) {
      console.error(error);
      searchStatus.value = 'error';
    }
  }

  return {
    popular,
    popularStatus,
    searchQuery,
    searchResults,
    searchPage,
    searchHasMore,
    searchStatus,
    isSearching,
    resultCount,
    loadPopular,
    search,
    loadMore,
    refresh,
    resetSearch,
  };
});
