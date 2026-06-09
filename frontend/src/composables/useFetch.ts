import { ref } from 'vue';
import type { TmdbMovie } from '@/lib/tmdb.types';

const popularMovies = ref<TmdbMovie[]>([]);
const searchedMovies = ref<TmdbMovie[]>([]);
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');

export function useFetch() {
  async function fetchPopular() {
    try {
      isLoading.value = 'loading';
      const res = await fetch('/v1/tmdb/popular');
      const data: TmdbMovie[] = await res.json();
      isLoading.value = 'finish';
      popularMovies.value = data;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  async function searchMovies(inputQuery: string) {
    try {
      isLoading.value = 'loading';
      const res = await fetch(`/v1/tmdb/search?query=${encodeURIComponent(inputQuery)}`);
      const data: TmdbMovie[] = await res.json();
      isLoading.value = 'finish';
      searchedMovies.value = data;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  return { fetchPopular, searchMovies, popularMovies, searchedMovies, isLoading };
}
