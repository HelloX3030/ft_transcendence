import { fetchJson } from '@/stores/movies';
import type {
  apiResponse as ApiResponse,
  TmdbMovieDetails,
  WatchlistCreateRequest,
  WatchlistMovieRequest,
  WatchlistMovieResponse,
  WatchlistResponse,
} from '@trailertinder/shared';
import { ref } from 'vue';

const watchlists = ref<WatchlistResponse[] | null | undefined>([]);
const isLoading = ref<'loading' | 'pending' | 'finish' | 'error'>('pending');

export function useWatchlist() {
  async function fetchBackend<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
    });

    return response.json();
  }

  async function fetchAllWatchlists() {
    try {
      isLoading.value = 'loading';
      //   await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await fetchBackend<WatchlistResponse[]>(
        'http://localhost:3000/v1/watchlists',
      );
      console.log(response);
      isLoading.value = 'finish';
      watchlists.value = response?.data;
    } catch (error) {
      isLoading.value = 'error';
      console.log(error);
    }
  }

  async function createWatchlist(watchlist: WatchlistCreateRequest) {
    try {
      isLoading.value = 'loading';
      const response = await fetchBackend<WatchlistResponse>(
        'http://localhost:3000/v1/watchlists',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(watchlist),
        },
      );
      console.log(response);
      isLoading.value = 'finish';
      return response.data;
    } catch (error) {}
  }

  async function addMovietoWatchlist(watchlistId: number, movie: WatchlistMovieRequest) {
    try {
      isLoading.value = 'loading';
      const response = await fetchBackend(
        `http://localhost:3000/v1/watchlists/${watchlistId}/movies`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(movie),
        },
      );
      console.log(response);
      isLoading.value = 'finish';
    } catch (error) {}
  }

  async function getMovieIdsFromWatchlist(watchlistId: number) {
    try {
      isLoading.value = 'loading';
      const response = await fetchBackend<WatchlistMovieResponse[]>(
        `http://localhost:3000/v1/watchlists/${watchlistId}/movies`,
        {
          method: 'GET',
        },
      );
      console.log(response);
      isLoading.value = 'finish';
      return response.data;
    } catch (error) {}
  }

  //https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg
  async function getMovieInfos(tmdbId: number) {
    fetchJson<TmdbMovieDetails>(`https://api.themoviedb.org/3/movie/${tmdbId}language=en-US`);
  }

  return {
    fetchAllWatchlists,
    createWatchlist,
    addMovietoWatchlist,
    getMovieIdsFromWatchlist,
    getMovieInfos,
    isLoading,
    watchlists,
  };
}
