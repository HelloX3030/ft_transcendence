import { ref } from 'vue';
import type { PaginatedMovies, TmdbMovie } from '@/lib/tmdb.types';

const popularMovies = ref<TmdbMovie[]>([]);
const searchedMovies = ref<TmdbMovie[]>([]);
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');

// Active search state — drives pagination/infinite scroll of the search results.
const searchQuery = ref('');
const searchPage = ref(1);
const searchedHasMore = ref(false);

// Fetches JSON and throws on HTTP errors — otherwise an error body would be
// parsed as PaginatedMovies and `results: undefined` would crash the views.
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with status ${res.status}`);
  return (await res.json()) as T;
}

function fetchSearchPage(query: string, page: number): Promise<PaginatedMovies> {
  return fetchJson<PaginatedMovies>(
    `/v1/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`,
  );
}

export function useFetch() {
  async function fetchPopular() {
    try {
      isLoading.value = 'loading';
      const data = await fetchJson<PaginatedMovies>('/v1/tmdb/popular');
      isLoading.value = 'finish';
      popularMovies.value = data.results;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  // Starts a fresh search: resets to page 1 and replaces the previous results.
  // An empty (or whitespace) query clears the search instead — the backend
  // rejects empty queries, and the views fall back to the popular list.
  async function searchMovies(inputQuery: string) {
    const query = inputQuery.trim();
    if (!query) {
      searchQuery.value = '';
      searchPage.value = 1;
      searchedMovies.value = [];
      searchedHasMore.value = false;
      return;
    }
    try {
      isLoading.value = 'loading';
      searchQuery.value = query;
      searchPage.value = 1;
      const data = await fetchSearchPage(query, 1);
      searchedMovies.value = data.results;
      searchedHasMore.value = data.hasMore;
      isLoading.value = 'finish';
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  // Loads the next page of the current search and appends to the existing results.
  async function loadMoreSearchedMovies() {
    if (isLoading.value === 'loading' || !searchQuery.value || !searchedHasMore.value) return;
    try {
      isLoading.value = 'loading';
      const nextPage = searchPage.value + 1;
      const data = await fetchSearchPage(searchQuery.value, nextPage);
      searchPage.value = nextPage;
      searchedMovies.value = [...searchedMovies.value, ...data.results];
      searchedHasMore.value = data.hasMore;
      isLoading.value = 'finish';
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  return {
    fetchPopular,
    searchMovies,
    loadMoreSearchedMovies,
    popularMovies,
    searchedMovies,
    searchedHasMore,
    searchQuery,
    isLoading,
  };
}
