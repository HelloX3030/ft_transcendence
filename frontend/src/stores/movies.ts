import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { apiResponse, PaginatedMovies, TmdbMovie } from '@trailertinder/shared';

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

// Fetches JSON and throws on HTTP errors — otherwise an error body would be
// parsed as the expected type and missing fields would crash the views.
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
  return (await res.json()) as T;
}

// Unwraps the backend's apiResponse envelope to the plain PaginatedMovies the
// feeds expect, throwing when the call did not succeed or carried no data.
async function fetchMovies(url: string): Promise<PaginatedMovies> {
  const res = await fetchJson<apiResponse<PaginatedMovies>>(url);
  if (!res.success || !res.data) throw new Error(res.error ?? `Request to ${url} returned no data`);
  return res.data;
}

// A paginated, append-as-you-scroll movie collection. Popular and search are the
// same machine — they differ only in which URL a page maps to — so both are built
// from this one factory. `fetchPage` reads any live state (query, filter) at call
// time, so callers just flip those refs and (re)load.
function createMovieFeed(fetchPage: (page: number) => Promise<PaginatedMovies>) {
  const items = ref<TmdbMovie[]>([]);
  const page = ref(1);
  const hasMore = ref(false);
  const status = ref<FetchStatus>('idle');

  // Bumped on every (re)load and reset. A slower in-flight request that resolves
  // after the feed has moved on (filter toggled mid-scroll, search cleared/replaced)
  // sees a stale token and drops its result instead of corrupting the list.
  let generation = 0;

  // Filtering can drop every movie on a page while TMDB still reports more pages.
  // Without a bound, infinite scroll would walk those empty pages back-to-back.
  // After this many empty pages in a row we treat the feed as exhausted.
  const MAX_EMPTY_PAGES = 3;
  let emptyPageStreak = 0;

  // (Re)loads page 1, replacing any existing results. Clears immediately so the
  // view shows skeletons (not stale entries) while loading and stays empty on
  // error. Returns the response so callers can read extra fields (e.g. total).
  async function load(): Promise<PaginatedMovies | undefined> {
    const gen = ++generation;
    status.value = 'loading';
    page.value = 1;
    items.value = [];
    hasMore.value = false;
    emptyPageStreak = 0;
    try {
      const data = await fetchPage(1);
      if (gen !== generation) return undefined;
      items.value = data.results;
      hasMore.value = data.hasMore;
      status.value = 'ready';
      return data;
    } catch (error) {
      if (gen !== generation) return undefined;
      console.error(error);
      status.value = 'error';
      return undefined;
    }
  }

  // Loads the next page and appends to the existing results (infinite scroll).
  async function loadMore(): Promise<void> {
    if (status.value === 'loading' || !hasMore.value) return;
    const gen = generation;
    status.value = 'loading';
    const nextPage = page.value + 1;
    try {
      const data = await fetchPage(nextPage);
      if (gen !== generation) return;
      page.value = nextPage;
      items.value = [...items.value, ...data.results];
      emptyPageStreak = data.results.length === 0 ? emptyPageStreak + 1 : 0;
      // Stop once TMDB has no more pages, or after too many filtered-empty ones.
      hasMore.value = data.hasMore && emptyPageStreak < MAX_EMPTY_PAGES;
      status.value = 'ready';
    } catch (error) {
      if (gen !== generation) return;
      console.error(error);
      status.value = 'error';
    }
  }

  function reset(): void {
    generation++;
    items.value = [];
    page.value = 1;
    hasMore.value = false;
    status.value = 'idle';
    emptyPageStreak = 0;
  }

  return { items, page, hasMore, status, load, loadMore, reset };
}

export const useMoviesStore = defineStore('movies', () => {
  // Whether the quality filter (poster + vote count/average) is applied — shared
  // by both feeds and part of each request URL (user toggle).
  const filtered = ref(true);

  // Popular list — the default browse state, paginated like search.
  const popularFeed = createMovieFeed((page) =>
    fetchMovies(`/v1/tmdb/popular?page=${page}&filtered=${filtered.value}`),
  );

  // Active search session — the query drives which results the feed fetches.
  const searchQuery = ref('');
  // TMDB's total match count for the current query (see backend caveat: unfiltered).
  const searchTotal = ref(0);
  const searchFeed = createMovieFeed((page) =>
    fetchMovies(
      `/v1/tmdb/search?query=${encodeURIComponent(searchQuery.value)}&page=${page}&filtered=${filtered.value}`,
    ),
  );

  const isSearching = computed(() => searchQuery.value !== '');
  const resultCount = computed(() => searchFeed.items.value.length);

  function loadPopular(): Promise<unknown> {
    return popularFeed.load();
  }

  // Ends the active search session and clears its results — views fall back to
  // the popular list.
  function resetSearch(): void {
    searchQuery.value = '';
    searchTotal.value = 0;
    searchFeed.reset();
  }

  // Starts a fresh search: resets to page 1 and replaces the previous results.
  // An empty (or whitespace) query clears the search instead — the backend
  // rejects empty queries.
  async function search(input: string): Promise<void> {
    const query = input.trim();
    if (!query) {
      resetSearch();
      return;
    }
    searchQuery.value = query;
    searchTotal.value = 0;
    const data = await searchFeed.load();
    if (data) searchTotal.value = data.totalResults;
  }

  // Retries the current view after a failure: re-runs the active search (from
  // page 1) when searching, otherwise reloads the popular list.
  function refresh(): void {
    if (isSearching.value) void search(searchQuery.value);
    else void loadPopular();
  }

  // Toggles the result filter and rebuilds the currently shown view (from page 1)
  // so filtered and unfiltered pages never mix in one list.
  function setFiltered(value: boolean): void {
    if (value === filtered.value) return;
    filtered.value = value;
    refresh();
  }

  return {
    // Popular feed
    popular: popularFeed.items,
    popularStatus: popularFeed.status,
    popularHasMore: popularFeed.hasMore,
    loadPopular,
    loadMorePopular: popularFeed.loadMore,
    // Search feed
    searchResults: searchFeed.items,
    searchPage: searchFeed.page,
    searchHasMore: searchFeed.hasMore,
    searchStatus: searchFeed.status,
    loadMore: searchFeed.loadMore,
    // Search session meta
    searchQuery,
    searchTotal,
    isSearching,
    resultCount,
    // Shared
    filtered,
    search,
    refresh,
    resetSearch,
    setFiltered,
  };
});
