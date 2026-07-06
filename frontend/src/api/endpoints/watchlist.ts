import { backendClient } from '../client';
import type {
  WatchlistCreateRequest,
  WatchlistMovieRequest,
  WatchlistMovieResponse,
  WatchlistRequest,
  WatchlistResponse,
  WatchlistUpdateRequest,
} from '@trailertinder/shared';

export const watchlistApi = {
  getById: (id: number) => backendClient<WatchlistResponse>(`/watchlists/${id}`),

  getAll: () => backendClient<WatchlistResponse[]>('/watchlists'),

  create: (data: WatchlistCreateRequest) =>
    backendClient<WatchlistResponse>('/watchlists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

  delete: (id: number, movieId: number) =>
    backendClient<void>(`/watchlists/${id}/movies/${movieId}`, { method: 'DELETE' }),

  update: (id: number, data: WatchlistUpdateRequest) =>
    backendClient<WatchlistResponse>(`/watchlists/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

  addMovie: (id: number, movie: WatchlistMovieRequest) =>
    backendClient(`/watchlists/${id}/movies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(movie),
    }),

  getMoviesById: async (id: number) =>
    backendClient<WatchlistMovieResponse[]>(`/watchlists/${id}/movies`, {
      method: 'GET',
    }),
};
