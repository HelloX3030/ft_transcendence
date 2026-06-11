import { ref } from 'vue';
import type { PaginatedMovies, TmdbMovie } from '@/lib/tmdb.types';

const popularMovies = ref<TmdbMovie[]>([]);
const searchedMovies = ref<TmdbMovie[]>([]);
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');

// Active search state — drives pagination/infinite scroll of the search results.
const searchQuery = ref('');
const searchPage = ref(1);
const searchedHasMore = ref(false);

async function fetchSearchPage(query: string, page: number): Promise<PaginatedMovies> {
  const res = await fetch(`/v1/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`);
  return (await res.json()) as PaginatedMovies;
}

export function useFetch() {
  async function fetchPopular() {
    try {
      isLoading.value = 'loading';
      const res = await fetch('/v1/tmdb/popular');
      const data: PaginatedMovies = await res.json();
      isLoading.value = 'finish';
      popularMovies.value = data.results;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  // Starts a fresh search: resets to page 1 and replaces the previous results.
  async function searchMovies(inputQuery: string) {
    try {
      isLoading.value = 'loading';
      searchQuery.value = inputQuery;
      searchPage.value = 1;
      const data = await fetchSearchPage(inputQuery, 1);
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
