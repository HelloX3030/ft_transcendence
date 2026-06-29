import { options, popular } from '@/lib/test';
import type {
  apiResponse as ApiResponse,
  WatchlistCreateRequest,
  WatchlistMovieRequest,
  WatchlistResponse,
} from '@trailertinder/shared';
import { ref } from 'vue';

const popularMovies = ref<typeof popular>([]);
const searchedMovies = ref<typeof popular>([]);
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');

enum Method {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export function useFetch() {
  async function fetchBackend<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
    });

    return response.json();
  }

  async function fetchPopular() {
    try {
      isLoading.value = 'loading';
      // await new Promise((resolve) => setTimeout(resolve, 3000));

      const res = await fetch(
        'https://api.themoviedb.org/3/movie/popular?language=en-US&page=1',
        options,
      );

      const data = await res.json();
      isLoading.value = 'finish';
      popularMovies.value = data.results;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  async function searchMovies(inputQuery: string) {
    try {
      isLoading.value = 'loading';
      // await new Promise((resolve) => setTimeout(resolve, 3000));
      console.log(inputQuery);
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${inputQuery}&include_adult=false&language=en-US&page=1`,
        options,
      );
      const data = await res.json();
      isLoading.value = 'finish';
      console.log(data.results);
      searchedMovies.value = data.results;
    } catch (error) {
      console.error(error);
      isLoading.value = 'error';
    }
  }

  async function fetchAllWatchlists() {
    try {
      isLoading.value = 'loading';
      const data = await fetchBackend<WatchlistResponse[]>('http://localhost:3000/v1/watchlists');
      console.log(data);
      isLoading.value = 'finish';
      return data.data;
    } catch (error) {
      isLoading.value = 'error';
      console.log(error);
    }
  }

  async function createWatchlist(watchlist: WatchlistCreateRequest) {
    try {
      isLoading.value = 'loading';
      const data = await fetchBackend('http://localhost:3000/v1/watchlists', { method: 'POST' });
      console.log(data);
      isLoading.value = 'finish';
    } catch (error) {}
  }

  async function addMovietoWatchlist(movie: WatchlistMovieRequest) {
    try {
      isLoading.value = 'loading';
      const data = await fetchBackend(
        `http://localhost:3000/v1/watchlists/${movie.tmdbId}/movies`,
        {
          method: 'POST',
        },
      );
      console.log(data);
      isLoading.value = 'finish';
    } catch (error) {}
  }

  return {
    fetchPopular,
    searchMovies,
    fetchAllWatchlists,
    createWatchlist,
    addMovietoWatchlist,
    popularMovies,
    searchedMovies,
    isLoading,
  };
}
