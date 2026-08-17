import { backendClient } from '../client';
import type {
  WatchlistCreateRequest,
  WatchlistMovieRequest,
  WatchlistMovieResponse,
  WatchlistResponse,
  WatchlistRole,
  WatchlistUpdateRequest,
  WatchlistUserResponse,
} from '@cinemates/shared';

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

  update: (id: number, data: WatchlistUpdateRequest) =>
    backendClient<WatchlistResponse>(`/watchlists/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }),

  delete: (id: number) => backendClient(`/watchlists/${id}`, { method: 'DELETE' }),

  addMovie: (id: number, movie: WatchlistMovieRequest) =>
    backendClient(`/watchlists/${id}/movies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(movie),
    }),

  deleteMovie: (id: number, movieId: number) =>
    backendClient(`/watchlists/${id}/movies/${movieId}`, { method: 'DELETE' }),

  getMoviesById: (id: number) =>
    backendClient<WatchlistMovieResponse[]>(`/watchlists/${id}/movies`, {
      method: 'GET',
    }),

  getUsers: (id: number) => backendClient<WatchlistUserResponse[]>(`/watchlists/${id}/users`),

  addUser: (id: number, payload: { userId: number; role: WatchlistRole }) => {
    return backendClient(`/watchlists/${id}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },
  deleteUser: (id: number, userId: number) => {
    return backendClient(`/watchlists/${id}/users/${userId}`, {
      method: 'DELETE',
    });
  },
};
